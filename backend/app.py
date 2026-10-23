import streamlit as st
import time

st.set_page_config(
  page_title="AI",
  page_icon="",
  layout="wide",
  initial_sidebar_state="collapsed"
)

def load_css(file_path):
  with open(file_path, "r", encoding="utf-8") as f:
    st.markdown(f"<style>{f.read()}</style>", unsafe_allow_html=True)

# css
st.markdown("""
    <!-- 부트스트랩5 폰트어썸 6 cdn -->
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css" rel="stylesheet">
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css" rel="stylesheet">
""", unsafe_allow_html=True)

load_css("style.css")

# 3. 세션상태 초기화
if "messages" not in st.session_state:
  st.session_state.messages = [
    {"role": "assistant", "content": "안녕하세요! 지역 맛집이나 학원을 물어보세요. AI 어시스턴트입니다!"}
  ]

if "show_map" not in st.session_state:
  st.session_state.show_map = False

if "selected_district" not in st.session_state:
  st.session_state.selected_district = "노원구"

if "places" not in st.session_state:
  st.session_state.places = []

# 4. 상단 레이아웃 구성
col_logo, col_sel, col_stat = st.columns([3.4, 1.1, 1.3], gap="small", vertical_alignment="center")

with col_logo:
  st.markdown("""
    <div class="d-flex align-items-center gap-3">
      <div class="d-flex align-items-center justify-content-center rounded-4 shadow-sm logoSize">
        <i class="fa-solid fa-robot"></i>
      </div>
      <div class="d-flex flex-column justify-content-center">
        <div class="d-flex align-items-baseline gap-2 m-0">
          <span class="text-warning aiText">AI</span>
          <span class="fw-bold text-white localText">로컬 어시스턴트</span>
        </div>
        <span class="text-secondary">지역 맞춤형 맛집 및 학원 추천</span>
      </div>
    </div>    
  """, unsafe_allow_html=True)

with col_sel:
  districts = ["노원구", "도봉구", "강북구", "중랑구", "성북구"]
  selected = st.selectbox(
    "지역 선택",
    districts,
    index=districts.index(st.session_state.selected_district),
    label_visibility="collapsed",
  )
  st.session_state.selected_district = selected


with col_stat:
  if st.session_state.show_map:
    badge_html = '<i class="fa-solid fa-map me-2"></i><span>지도 연동 활성화</span>'
  else:
    badge_html = '<i class="fa-solid fa-comments me-2"></i><span>AI 대화 모드</span>'
  st.markdown(f"""
    <div class="bs-glass-box d-flex align-items-center justify-content-center px-3 fw-bold">
      {badge_html}
    </div>
  """, unsafe_allow_html=True)

st.markdown("<hr class='my-3 border-secondary opacity-25' />",
            unsafe_allow_html=True)

# 5 중앙 메인 레이아웃
if st.session_state.show_map:
  chat_col, map_col = st.columns([1, 1], gap="medium", vertical_alignment="top")
else:
  chat_col = st.container()

# 좌측영역
with (chat_col if not st.session_state.show_map else chat_col):
  chat_container = st.container(height=480, border=True)
  with chat_container:
    # 기존 대화 기록 순회 출력
    for message in st.session_state.messages:
      if message["role"] == "assistant":
        st.markdown(f"""
          <div class="d-flex align-items-end gap-2 mb-3 justify-content-start">
            <div class="d-flex align-items-center justify-content-center rounded-3 shadow-sm p-2 border border-white">
              <i class="fa-solid fa-robot fs15"></i>
            </div>
            <div class="bs-chat-bubble-ai mw82">
              {message["content"]}
            </div>
          </div>
        """, unsafe_allow_html=True)
      else:
        st.markdown(f"""
          <div class="d-flex align-items-end gap-2 mb-3 justify-content-end">
            <div class="bs-chat-bubble-user mw82">
              {message["content"]}
            </div>
            <div class="d-flex align-items-center justify-content-center rounded-3 shadow-sm p-2 border border-white">
              <i class="fa-solid fa-user fs15"></i>
            </div>
          </div>
        """, unsafe_allow_html=True)
  # 하단 입력 폼 (텍스트 입력 및 전송 버튼)
  with st.form(key="chat_form", clear_on_submit=True):
    f_col1, f_col2 = st.columns([5.2, 1], gap="small", vertical_alignment="center")
    with f_col1:
      user_input = st.text_input(
        "메시지 입력",
        placeholder=f"{st.session_state.selected_district} 맛집이나 학원을 물어보세요...",
        label_visibility="collapsed"
      )
    with f_col2:
      submit_btn = st.form_submit_button("전송", use_container_width=True)
    # 전송 버튼 클릭 시 동작 로직
    if submit_btn and user_input.strip():
      # 1 사용자 질문 세션에 추가
      st.session_state.messages.append({"role": "user", "content": user_input})
      # 2. 키워드 분석을 통해 지도 모드 판단
      lower_q = user_input.lower()
      is_location = any(k in lower_q for k in ["맛집", "학원", "식당", "카페", "추천", "근처"])
      st.session_state.show_map = is_location

      # 3. AI 응답 생성 시뮬레이션 (실제 구현 시 Groq API 연동 가능)
      with st.spinner("최적의 장소 분석 중..."):
        time.sleep(0.4)
        if is_location:
          ai_reply = f"<b>[{st.session_state.selected_district}]에서 엄선한 추천 장소들을 지도와 함께 정리해 드렸습니다! 우측 카드를 확인해 보세요.</b>"
          # 가상의 추천 장소 데이터 세팅
          st.session_state.places = [
            {
              "name": f"{st.session_state.selected_district} 모범 한식당",
              "category": "맛집",
              "address": f"서울특별시 {st.session_state.selected_district} 동일로 123",
              "is_registered": True,
              "description": "신선한 재료와 깊은 국물 맛이 일품인 현지인 추천 맛집입니다."
            },
            {
              "name": f"{st.session_state.selected_district} 탑클래스 학원",
              "category": "학원",
              "address": f"서울특별시 {st.session_state.selected_district} 상계로 45",
              "is_registered": False,
              "description": "체계적인 커리큘럼과 1:1 맞춤 피드백을 제공하는 전문 교육 기관입니다."
            }
          ]
        else:
          ai_reply = f"<b>말씀하신 내용에 대해 [{st.session_state.selected_district}] 기준에서 친절하게 답변해 드릴께요</b>"
          st.session_state.places = []

      #  AI 답변 세션에 추가 후 새로고침
      st.session_state.messages.append({"role": "assistant", "content": ai_reply})
      st.rerun()

# 우측영역
if st.session_state.show_map:
  with map_col:
    map_container = st.container(height=480, border=True)
    with map_container:
      st.markdown(f"""
        <div class="d-flex flex-column justify-content-between align-items-center p-3 mb-3 rounded-4 mapCard"> 
          <div class="d-flex align-items-center gap-2 fw-bold text-white fs13">
            <div style="background: rgba(15, 23, 42, 0.8); padding: 8px 14px; border-radius: 12px; font-size: 12px; font-weight: bold; color: #fff; border: 1px solid rgba(255,255,255,0.1);">
              <span class="text-info fw-semibold">
                <i class="fa-solid fa-circle me-1 fs8"></i> AI 추천
              </span>
              <span>{st.session_state.selected_district} 추천 장소 지도</span>
            </div>
          </div>  
    
          <div class="d-flex flex-column align-items-center justify-content-center py-3 mb-3 rounded-4 bgRadial">
            <i class="fa-solid fa-map-location-dot text-primary mb-2 fs28"></i>
            <div class="">
              <span class="font-monospace text-info fs11">[ Kakao Map Interactive Layer Active ]</span>
            </div>
          </div>
        </div>
        """, unsafe_allow_html=True)
    # 지도 닫기 버튼
    if st.button("지도 닫기 X", key="close_map_btn"):
      st.session_state.show_map = False
      st.rerun()

    # 토스트 형태의 장소 카드리스트 렌더링 영역
    st.markdown(
      "<div style='position: relative; z-index: 10; flex: 1; overflow-y: auto; margin-top: 10px; padding-right: 4px;'>",
      unsafe_allow_html=True)

    if st.session_state.places:
      for place in st.session_state.places:
        badge_color = "#3b82f6" if place["is_registered"] else "#fde047"
        badge_text = "공식 등록" if place["is_registered"] else "커스텀 추천"

        st.markdown(f"""
          <div class="place-card">
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
                  <h4 style="margin: 0; font-size: 14px; font-weight: bold; color: #ffffff;">{place['name']}</h4>
                  <span style="font-size: 10px; padding: 2px 8px; border-radius: 8px; background: rgba({'59, 130, 246' if place['is_registered'] else '253, 224, 71'}, 0.2); color: {badge_color}; font-weight: 600; border: 1px solid rgba(255,255,255,0.05);">
                      {badge_text}
                  </span>
              </div>
              <p style="margin: 0 0 6px 0; font-size: 11px; color: #94a3b8;">
                  📍 {place['address']} ({place['category']})
              </p>
              <div style="background: rgba(13, 17, 26, 0.6); padding: 8px 12px; border-radius: 10px; font-size: 11px; color: #cbd5e1; border: 1px solid rgba(255,255,255,0.03);">
                  {place['description']}
              </div>
          </div>
        """, unsafe_allow_html=True)
    else:
      st.markdown("""
        <div style="background: rgba(19, 27, 46, 0.8); backdrop-filter: blur(8px); border-radius: 12px; padding: 30px; text-align: center; color: #94a3b8; font-size: 12px; border: 1px solid rgba(255,255,255,0.05);">
          🔍 표시할 장소 데이터가 없습니다. 맛집이나 학원을 검색해 보세요!
        </div>
      """, unsafe_allow_html=True)

    st.markdown("</div></div>", unsafe_allow_html=True)