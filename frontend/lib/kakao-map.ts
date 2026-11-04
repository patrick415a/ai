// Redux에서 사용하는 장소 데이터 타입을 가져온다. 이 파일에서 Redux 상태를 직접 바꾸지는 않는다.
import type { PlaceInfo } from '../store/chatSlice';

// 아래 interface들은 SDK 사용 방법을 TypeScript에 알려주는 타입 설명이다.
// 카카오 지도를 직접 구현한 클래스가 아니며, 실제 객체는 브라우저에서 불러온 SDK가 제공한다.
// 한 지점의 위도/경도를 담는 좌표 객체이다.
interface LatLng {
  // 해당 좌표의 위도와 경도를 숫자로 반환한다.
  getLat(): number;
  getLng(): number;
}

// 여러 장소를 모두 포함하는 사각형 범위를 담는 객체이다.
interface LatLngBounds {
  // 새 장소의 좌표까지 포함하도록 범위를 넓힌다.
  extend(position: LatLng): void;
}

export interface KakaoMapInstance {
  // 지도 HTML 영역의 변경된 크기를 SDK에 반영한다.
  relayout(): void;
  // 중심 좌표를 즉시 변경한다.
  setCenter(position: LatLng): void;
  // 지정한 좌표로 지도를 이동한다. 가까운 거리는 부드럽게 이동한다.
  panTo(position: LatLng): void;
  // 확대 수준을 설정한다. 작은 숫자일수록 더 확대된다.
  setLevel(level: number): void;
  // 전달받은 범위가 모두 보이도록 중심/확대 수준을 맞춘다. 나머지 인수는 각 방향의 여백이다.
  setBounds(bounds: LatLngBounds, top: number, right: number, bottom: number, left: number): void;
}

// window.kakao.maps 안에서 이 프로젝트가 사용하는 생성자와 함수들이다.
export interface KakaoMaps {
  // 지도 기능의 내부 로딩이 끝났을 때 callback을 실행한다.
  load(callback: () => void): void;
  // new로 좌표, 사각형 범위, 실제 지도 객체를 각각 생성한다.
  LatLng: new (lat: number, lng: number) => LatLng;
  LatLngBounds: new () => LatLngBounds;
  Map: new (container: HTMLElement, options: { center: LatLng; level: number }) => KakaoMapInstance;
  // 직접 만든 HTML 버튼을 지도 위에 올릴 때 사용하는 커스텀 오버레이이다.
  CustomOverlay: new (options: {
    // 어느 지도에, 어느 좌표로, 어떤 HTML 요소를 표시할지 지정한다.
    map: KakaoMapInstance;
    position: LatLng;
    content: HTMLElement;
    // true면 오버레이를 눌렀을 때 지도 빈 곳의 클릭 이벤트로 이어지지 않게 한다.
    clickable: boolean;
    // 세로 기준점: 1이면 HTML 요소의 아래쪽이 해당 장소 좌표에 맞춰진다.
    yAnchor: number;
    // 지도 위 요소 사이의 겹침 순서. 큰 숫자가 앞에 표시된다.
    zIndex: number;
  }) => {
    // null을 전달하면 지도에서 제거한다. setZIndex는 겹침 순서를 변경한다.
    setMap(map: KakaoMapInstance | null): void;
    setZIndex(zIndex: number): void;
  };
  // 장소명/주소/링크를 보여주는 말풍선이다. removable은 닫기 버튼 표시 여부이다.
  InfoWindow: new (options: { removable: boolean; zIndex: number }) => {
    // 내용과 표시 좌표를 설정한 뒤 open으로 열고 close로 닫는다.
    setContent(content: HTMLElement): void;
    setPosition(position: LatLng): void;
    open(map: KakaoMapInstance): void;
    close(): void;
  };
  // SDK가 관리하는 지도 클릭 이벤트를 등록하거나 해제한다.
  event: {
    addListener(target: KakaoMapInstance, type: string, listener: () => void): void;
    removeListener(target: KakaoMapInstance, type: string, listener: () => void): void;
  };
}

// SDK가 window.kakao를 추가한다는 사실을 TypeScript에 알려준다.
// ?는 SDK 로딩 전에는 kakao가 없을 수 있다는 뜻이며, 이 선언 자체가 SDK를 불러오지는 않는다.
declare global {
  interface Window {
    kakao?: { maps: KakaoMaps };
  }
}

// 지도에 사용할 수 있는 숫자 좌표인지 확인한다. 실제 업체 위치가 맞는지 검색하는 기능은 아니다.
export function hasValidCoordinates(place: PlaceInfo): boolean {
  // NaN/Infinity/숫자가 아닌 값과 위도·경도 범위를 벗어난 값을 제외한다.
  // (0, 0)도 이 서비스에서는 장소 좌표로 사용하지 않아 제외한다.
  return Number.isFinite(place.lat) && Number.isFinite(place.lng)
    && place.lat >= -90 && place.lat <= 90
    && place.lng >= -180 && place.lng <= 180
    && !(place.lat === 0 && place.lng === 0);
}

// 추천 목록 한 묶음의 마커와 말풍선을 만들고 제어하는 함수이다.
// maps: 카카오 SDK / map: 현재 지도 / places: 추천 목록
// onSelect: 선택 결과를 부모 컴포넌트로 전달하는 선택적 콜백 함수
// 반환값의 select, fit, destroy를 KakaoMap.tsx에서 호출한다.
export function createPlaceLayer(
  maps: KakaoMaps,
  map: KakaoMapInstance,
  places: PlaceInfo[],
  onSelect?: (index: number | null) => void,
) {
  // 모든 장소가 보이도록 계산할 범위와, 실제 표시한 좌표 목록을 준비한다.
  const bounds = new maps.LatLngBounds();
  const positions: LatLng[] = [];
  // 말풍선은 하나만 만들고, 선택할 때 내용/좌표를 교체해 여러 개가 동시에 열리지 않게 한다.
  // zIndex 4는 일반 마커(2), 선택 마커(3)보다 앞쪽에 표시하기 위한 값이다.
  const infoWindow = new maps.InfoWindow({ removable: true, zIndex: 4 });
  // 지도 크기가 바뀌어도 현재 선택한 장소를 유지하기 위해 인덱스를 기억한다.
  let selectedIndex: number | null = null;
  // 지도 빈 곳을 눌렀을 때 지도 선택을 해제하고 부모의 카드 선택도 해제한다.
  const closeInfo = () => {
    select(null);
    // ?.는 onSelect 함수가 전달된 경우에만 호출한다는 의미이다.
    onSelect?.(null);
  };

  // flatMap에서 []를 반환하면 해당 장소는 건너뛴다.
  // 유효한 장소는 제어에 필요한 정보를 배열에 담아 반환하고, 하나의 마커 목록으로 합친다.
  const markers = places.flatMap((place, index) => {
    if (!hasValidCoordinates(place)) return [];

    // 숫자 좌표를 SDK의 좌표 객체로 바꾸고 전체 표시 범위에 추가한다.
    const position = new maps.LatLng(place.lat, place.lng);
    positions.push(position);
    bounds.extend(position);

    // 이 HTML은 React JSX 대신 SDK가 지도 위에 붙인다.
    // 버튼의 SVG 배경, 색상과 선택 스타일은 main.styles.scss에서 지정한다.
    const button = document.createElement('button');
    button.type = 'button';
    // 기존 is_registered 값으로 파란색/주황색을 구분한다. 실제 등록 여부를 조회하지는 않는다.
    const baseClassName = `kakao-place-marker${place.is_registered ? '' : ' unregistered'}`;
    button.className = baseClassName;
    // 숫자는 배경과 별도 요소로 만들어 가려지지 않도록 한다.
    const label = document.createElement('span');
    label.className = 'kakao-place-marker-label';
    // 건너뛴 장소가 있어도 원래 카드 목록의 index를 사용해 카드와 마커 번호를 맞춘다.
    label.textContent = String(index + 1);
    button.append(label);
    // title은 마우스를 올렸을 때 표시할 이름이고, aria 속성은 보조기기용 설명/선택 상태이다.
    button.title = place.name;
    button.setAttribute('aria-label', `${index + 1}. ${place.name}, ${place.address}`);
    button.setAttribute('aria-pressed', 'false');

    // 말풍선의 HTML 요소를 만든다. textContent는 AI 응답을 HTML로 실행하지 않고 글자로 표시한다.
    const content = document.createElement('div');
    content.className = 'kakao-place-info';
    const name = document.createElement('strong');
    name.textContent = place.name;
    const address = document.createElement('p');
    address.textContent = place.address;
    // 이름/좌표가 들어 있는 카카오맵 링크를 만든다. 이름에 공백/특수문자가 있어도 URL로 전달한다.
    const link = document.createElement('a');
    link.textContent = '카카오맵에서 보기';
    link.href = `https://map.kakao.com/link/map/${encodeURIComponent(place.name)},${place.lat},${place.lng}`;
    link.target = '_blank';
    // 새 탭이 현재 페이지의 window.opener에 접근하지 못하게 하고 Referer 전달을 막는다.
    link.rel = 'noopener noreferrer';
    content.append(name, address, link);

    // 마커 클릭은 지도의 장소 정보와 스타일을 먼저 바꾸고, 부모에게 카드 선택을 요청한다.
    // 카드 재클릭에 의한 선택 해제는 page.tsx에서 null을 전달하는 방식으로 처리한다.
    const onClick = () => {
      select(index);
      onSelect?.(index);
    };
    button.addEventListener('click', onClick);

    // 버튼을 장소 좌표에 올린다. yAnchor: 1이므로 버튼 아래의 꼬리 끝이 좌표에 닿는다.
    // clickable: true는 마커 클릭이 아래의 지도 빈 곳 클릭으로 처리되지 않게 한다.
    const overlay = new maps.CustomOverlay({
      map, position, content: button, clickable: true, yAnchor: 1, zIndex: 2,
    });
    // 선택 변경과 제거 시 다시 사용할 정보 및 이벤트 함수를 보관한다.
    return [{ index, position, content, baseClassName, overlay, button, onClick }];
  });

  // 카드와 마커에서 같은 처리로 장소를 선택한다. null 또는 없는 인덱스면 선택을 해제한다.
  // 이 함수 안에서는 onSelect를 호출하지 않아, 부모 → 지도 → 부모의 반복 호출을 막는다.
  function select(index: number | null) {
    const selected = markers.find(marker => marker.index === index);
    // 좌표가 없어 마커를 만들지 않은 장소도 선택 대상으로 처리하지 않는다.
    selectedIndex = selected?.index ?? null;
    markers.forEach(marker => {
      // 선택한 마커에만 클래스, 접근성 상태, 높은 겹침 순서를 적용한다.
      const active = marker === selected;
      marker.button.className = `${marker.baseClassName}${active ? ' is-selected' : ''}`;
      marker.button.setAttribute('aria-pressed', String(active));
      marker.overlay.setZIndex(active ? 3 : 2);
    });

    // 선택 해제 시 말풍선은 닫고 현재 지도의 위치는 그대로 유지한다.
    if (!selected) {
      infoWindow.close();
      return;
    }

    // 선택한 장소로 이동한 뒤 공용 말풍선의 내용과 좌표를 바꾸고 표시한다.
    map.panTo(selected.position);
    infoWindow.setContent(selected.content);
    infoWindow.setPosition(selected.position);
    infoWindow.open(map);
  }

  // 버튼에는 DOM 이벤트를 사용하지만, 지도 빈 곳 클릭은 카카오 SDK 이벤트로 감지한다.
  maps.event.addListener(map, 'click', closeInfo);

  // KakaoMap.tsx에 공개하는 제어 기능이다.
  return {
    // 선택 상태를 지도에 반영한다.
    select,
    // 지도 영역 크기와 표시 범위를 맞춘다. 주로 ResizeObserver에서 호출한다.
    fit() {
      // 패널 열기/닫기나 화면 크기 변경 후 SDK가 지도 영역의 실제 크기를 다시 읽게 한다.
      map.relayout();
      // 표시할 좌표가 없으면 빈 범위로 지도 중심/확대 수준을 설정하지 않는다.
      if (positions.length === 0) return;

      // 선택한 장소가 있으면 전체 추천 범위 대신 그 장소를 중심으로 유지한다.
      const selected = markers.find(marker => marker.index === selectedIndex);
      if (selected) {
        map.setCenter(selected.position);
        return;
      }

      // 한 곳만 있거나 여러 장소가 같은 좌표이면 사각형 범위의 크기가 0이 된다.
      // 이때는 setBounds 대신 정해진 확대 수준과 중심 좌표를 사용한다.
      const first = positions[0];
      const samePosition = positions.every(position =>
        position.getLat() === first.getLat() && position.getLng() === first.getLng());
      if (samePosition) {
        map.setLevel(3);
        map.setCenter(first);
      } else {
        // 모든 추천 장소가 들어오도록 범위를 맞추며 위/오른쪽/아래/왼쪽 여백을 px로 준다.
        map.setBounds(bounds, 48, 40, 40, 40);
      }
    },
    // 추천 교체, 패널 닫기, 컴포넌트 제거 시 이 목록의 마커와 이벤트를 정리한다.
    // 지도 객체 자체를 삭제하는 함수는 아니므로 같은 지도를 다시 사용할 수 있다.
    destroy() {
      infoWindow.close();
      maps.event.removeListener(map, 'click', closeInfo);
      markers.forEach(({ overlay, button, onClick }) => {
        // SDK 오버레이를 지도에서 떼고, 등록할 때 사용한 동일한 함수로 클릭 이벤트를 해제한다.
        overlay.setMap(null);
        button.removeEventListener('click', onClick);
      });
    },
  };
}
