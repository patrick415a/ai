
# streamlit : HTML/CSS 없이 파이썬 코드 웹 화면(UI)을 만들어주는 라이브러리
import streamlit as st

# 백엔드 서버 (FastAPI)와 HTTP 통신을 하기 위해 requests 라이브러리
import requests

# head 스트림릿 코드 중에서 반드시 맨 처음에 실행
st.set_page_config(
    page_title="나만의 AI 챗봇",
    page_icon="🤖", #파비콘
    layout="centered" #wide를 사용하면 화면 100%
)

# 페이지 상단 제목 및 설명
st.title("🤖 나만의 AI 어시스턴트")
st.caption("AI 챗봇")

if "messages" not in st.session_state:
    # "messages"라는 리스트(목록)를 새로 만들고, 첫 번째 기본 인사말을 넣음
    st.session_state.messages = [
        {"role": "assistant", "content": "안녕하세요! 무엇이든 물어보세요. 오늘 어떤 도움이 필요하신가요?"}
    ]

# 화면에 이전 대화 내용(말풍선)들을 차례대로 그려주기
for message in st.session_state.messages:
    with st.chat_message(message["role"]):
        st.markdown(message["content"])

# 화면 아래에 채팅창 픽스해서 만듬
# := 기호는 바다코끼리 연산자라 하며 변수에 값을 넣는 것과 동시에 조건문을 검사 할 때 씀
if user_input := st.chat_input("메시지를 입력하세요...."):
    # 사용자가 방금 입력한 질문을 기억 공간에 추가
    st.session_state.messages.append({"role": "user", "content": user_input})
    # 화면에 사람 모양의 말풍선을 만들고 방금 입력한 질문을 즉시 화면에 표시
    with st.chat_message("user"):
        st.markdown(user_input)

    # FastAPI 백엔드 호출 및 AI 답변 출력
    with st.chat_message("assistant"):
        #백엔드 답변이 올 때 까지의 로딩화면
        with st.spinner("생각하는 중..."):
            try:
                # 서버와 동일한 주소와 경로를 변수에 저장
                fastapi_url = "http://localhost:8000/api/chat"
                # 백엔드가 돌려준 정보를 response 변수에 담는다
                response = requests.post(fastapi_url, json={"message": user_input}, timeout=60)
                # 만약 서버 통신 상태 코드가 200이라면
                if response.status_code == 200:
                    # 백엔드가 보내준 josn 데이터를 파이썬 딕셔너리 형태로 변환
                    data = response.json()
                    # 그 안에서 reply라는 이름표가 붙은 AI의 실제 답변 텍스트를 꺼냄
                    ai_reply = data.get("reply", "응답을 받지 못했습니다")
                else:
                    # 어떤 에러 번호가 났는지 안내 문구를 만듬
                    ai_reply = f"서버 에러가 발생하엿습니다. (상태코드:{response.status_code})"
            except Exception as e:
                # 서버 꺼져있거나 연결 실패 시
                ai_reply = f"FastAPI 백엔드 서버와 연결할 수 없습니다.\n\n (에러:{e})"
        st.markdown(ai_reply)
        st.session_state.messages.append({"role": "assistant", "content": ai_reply})


# streamlit run app.py --server.port 8000 로 실행

# [중요 개념] 스트림릿은 사용자가 채팅을 한 번 입력할 때마다 파이썬 코드를 위에서부터 아래로 '처음부터 다시' 실행합니다.
# 그래서 일반 변수에 대화를 저장하면 채팅을 칠 때마다 이전 대화가 다 날아가 버립니다.
# 이를 방지하기 위해 스트림릿의 '전용 기억 공간(st.session_state)'에 대화 목록을 보관합니다.
# 만약 기억 공간(session_state 안에) 아직 "message"라는 대화 목록 상자가 없다면 (즉, 처음 접속했다면)