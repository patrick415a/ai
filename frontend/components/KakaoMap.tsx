'use client';

// 지도는 window, 실제 HTML 요소와 React 훅을 사용하므로 브라우저에서 실행한다.
// Script는 외부 카카오 SDK를 불러오는 Next.js 컴포넌트이다.
import Script from 'next/script';
import { useEffect, useRef, useState } from 'react';
// import type은 타입 검사에만 사용하며, 브라우저에서 실행되는 코드에는 포함되지 않는다.
import type { PlaceInfo, PlaceSelection } from '@/store/chatSlice';
// 실제 마커/말풍선 처리와 좌표 검사는 별도 파일에 두고 이 컴포넌트에서 연결한다.
import { createPlaceLayer, hasValidCoordinates, type KakaoMapInstance } from '@/lib/kakao-map';

// page.tsx에서 지도 컴포넌트에 전달하는 값과 함수의 타입이다.
interface KakaoMapProps {
  // AI 응답으로 받은 추천 장소 목록. 각 장소에 이름, 주소, 위도, 경도가 들어 있다.
  places: PlaceInfo[];
  // 지도 패널이 현재 열려 있는지 나타낸다.
  isVisible: boolean;
  // 선택한 카드/마커의 원래 목록 인덱스. null이면 선택한 장소가 없다.
  selectedPlace: PlaceSelection | null;
  // 마커를 누르거나 지도 빈 곳을 눌렀을 때 부모에게 선택 결과를 알린다.
  onPlaceSelect: (index: number | null) => void;
}

// .env.local의 JavaScript 키를 읽는다. NEXT_PUBLIC_ 변수는 브라우저 코드에서도 사용할 수 있다.
// trim()은 복사해서 붙여 넣을 때 앞뒤에 들어간 공백을 제거한다.
const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_APP_KEY?.trim();

export default function KakaoMap({ places, isVisible, selectedPlace, onPlaceSelect }: KakaoMapProps) {
  // 지도가 실제로 그려질 <div>를 가리킨다. 아래 JSX의 ref={containerRef}와 연결된다.
  const containerRef = useRef<HTMLDivElement>(null);
  // 한 번 만든 지도 객체를 유지한다. 다시 렌더링해도 지도 자체를 매번 만들지 않는다.
  const mapRef = useRef<KakaoMapInstance | null>(null);
  // 현재 추천 목록의 마커들을 제어하는 객체를 보관한다.
  // ReturnType은 createPlaceLayer가 반환하는 객체(select, fit, destroy)의 타입을 가져온다.
  const layerRef = useRef<ReturnType<typeof createPlaceLayer> | null>(null);
  // SDK 상태는 안내 문구와 지도 생성 시점에 영향을 주므로 useState로 관리한다.
  // 반면 위의 useRef 값들은 변경해도 React의 화면 렌더링을 직접 발생시키지 않는다.
  const [sdkStatus, setSdkStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  // 전체 추천 개수와 비교해서 지도에 표시할 수 없는 장소가 있는지 안내한다.
  const validCount = places.filter(hasValidCoordinates).length;

  // 외부 SDK 스크립트가 준비되면 Script의 onReady에서 호출된다.
  const handleReady = () => {
    // SDK 요청이 끝났더라도 카카오 지도 기능이 없으면 오류 상태로 처리한다.
    if (!window.kakao?.maps) {
      setSdkStatus('error');
      return;
    }

    // autoload=false이므로 maps.load()를 호출해 지도 기능의 내부 로딩을 시작한다.
    // 콜백이 실행되면 ready로 바꾸고, 아래 지도 생성 useEffect가 실행되게 한다.
    window.kakao.maps.load(() => setSdkStatus('ready'));
  };

  // [로딩 시간 제한] 패널이 열린 상태에서 SDK를 계속 기다리는 일을 방지한다.
  useEffect(() => {
    // 키가 없거나 패널이 닫혔거나 이미 성공/실패가 결정됐으면 타이머가 필요 없다.
    if (!appKey || !isVisible || sdkStatus !== 'loading') return;

    // 15000ms(15초) 안에 준비되지 않으면 오류 안내를 표시한다.
    const timeout = window.setTimeout(() => setSdkStatus('error'), 15000);
    // 로딩 완료, 패널 닫기 또는 컴포넌트 제거 시 이전 타이머를 취소한다.
    return () => window.clearTimeout(timeout);
  }, [isVisible, sdkStatus]);

  // [지도와 마커 연결] 지도 준비 상태, 추천 목록, 패널 상태 등이 바뀔 때 실행된다.
  useEffect(() => {
    const container = containerRef.current;
    const maps = window.kakao?.maps;
    // 패널, SDK, 지도용 HTML 요소가 모두 준비된 경우에만 아래 코드를 실행한다.
    if (!isVisible || sdkStatus !== 'ready' || !container || !maps) return;

    if (!mapRef.current) {
      // 최초 생성 시 첫 번째 유효한 장소를 지도 중심으로 사용한다.
      // 유효한 장소가 없으면 ?? 연산자로 기본 좌표(서울시청 부근)를 사용한다.
      const firstPlace = places.find(hasValidCoordinates);
      mapRef.current = new maps.Map(container, {
        // LatLng의 인수 순서는 위도(lat), 경도(lng)이다.
        center: new maps.LatLng(firstPlace?.lat ?? 37.5665, firstPlace?.lng ?? 126.978),
        // 카카오 지도는 level 숫자가 작을수록 확대된다.
        level: 3,
      });
    }

    // 현재 추천 장소의 마커, 말풍선, 클릭 이벤트를 만들고 제어 객체를 저장한다.
    const layer = createPlaceLayer(maps, mapRef.current, places, onPlaceSelect);
    layerRef.current = layer;
    // 예약한 화면 갱신 작업의 ID. 다음 요청이나 정리 단계에서 취소할 때 사용한다.
    let frame = 0;
    const resizeMap = () => {
      // 크기 변경 알림이 연속으로 오면 이전 예약을 취소하고 가장 최근 작업만 남긴다.
      cancelAnimationFrame(frame);
      // 브라우저가 다음 화면을 그릴 시점에 지도 크기와 표시 범위를 조절한다.
      frame = requestAnimationFrame(() => {
        // 접힌 패널처럼 너비/높이가 0인 상태에서는 범위를 계산하지 않는다.
        if (container.clientWidth > 0 && container.clientHeight > 0) layer.fit();
      });
    };

    // 창 크기가 그대로여도 패널 열림 애니메이션으로 지도 영역의 너비는 바뀔 수 있다.
    // ResizeObserver로 지도 <div> 자체의 크기를 관찰해 이 경우에도 지도를 다시 맞춘다.
    const observer = new ResizeObserver(resizeMap);
    observer.observe(container);
    // 크기 변경 알림을 기다리기 전에도 최초 표시 범위를 한 번 맞춘다.
    resizeMap();

    // 의존성이 바뀌어 이 effect가 다시 실행되기 전이나 컴포넌트가 제거될 때 정리한다.
    // 이전 목록의 마커/이벤트를 제거해 새 추천과 중복되지 않게 한다.
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
      layer.destroy();
      layerRef.current = null;
    };
  }, [isVisible, sdkStatus, places, onPlaceSelect]);

  // [선택 동기화] page.tsx의 카드 선택/해제 결과를 실제 지도에 반영한다.
  // 위 effect에서 마커를 만든 다음 실행되며, null을 넘기면 말풍선과 마커 선택을 해제한다.
  useEffect(() => {
    if (isVisible && sdkStatus === 'ready') {
      layerRef.current?.select(selectedPlace?.index ?? null);
    }
  }, [selectedPlace, isVisible, sdkStatus, places, onPlaceSelect]);

  // 키가 없거나 SDK 로딩에 실패한 경우에는 로딩 문구 대신 오류 문구를 보여준다.
  const unavailable = !appKey || sdkStatus === 'error';

  return (
    // aria-label은 영역의 이름, aria-busy는 현재 로딩 중인지 보조기기에 알려준다.
    <div className="map-canvas" aria-label="추천 장소 카카오 지도" aria-busy={!unavailable && sdkStatus === 'loading'}>
      {/* 키가 있고 패널이 열렸거나 추천 데이터가 있을 때만 SDK를 불러온다.
          autoload=false: SDK 내부 로딩은 handleReady에서 직접 시작한다.
          afterInteractive: 페이지가 브라우저에서 활성화된 후 스크립트를 불러온다.
          onReady: 스크립트 준비 처리 / onError: 스크립트 요청 실패 처리 */}
      {appKey && (isVisible || places.length > 0) && (
        <Script
          id="kakao-maps-sdk"
          src={`https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`}
          strategy="afterInteractive"
          onReady={handleReady}
          onError={() => setSdkStatus('error')}
        />
      )}
      {/* 카카오 SDK가 이 div 안에 지도 타일, 마커와 말풍선을 그린다. */}
      <div ref={containerRef} className="kakao-map-container" />
      {/* 오류 → 로딩 → 일부/전체 좌표 누락 순으로 상태에 맞는 문구를 표시한다.
          모두 정상인 경우 마지막 null에 의해 안내 문구를 표시하지 않는다. */}
      {unavailable ? (
        <p className="map-status" role="status">지도를 불러올 수 없어요. 잠시 후 다시 확인해 주세요.</p>
      ) : sdkStatus === 'loading' ? (
        <p className="map-status" role="status">지도를 불러오는 중이에요.</p>
      ) : validCount < places.length ? (
        <p className="map-status map-status-notice" role="status">
          {validCount === 0 ? '지도에 표시할 위치 정보가 없어요.' : '일부 장소는 위치 정보가 없어 표시되지 않아요.'}
        </p>
      ) : null}
    </div>
  );
}
