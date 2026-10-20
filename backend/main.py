'''
    pip install fastapi uvicorn pydantic
    python.exe -m pip install --upgrade pip

    fastapi: 빠르고 간편한 파이선 프레임워크
    uvicorn: 서버를 실행 시켜주는 도구
    pydantic: 프론트엔드에서 넘어온 메시지 형식이 맞는지 검사
'''
from urllib.request import Request

from dotenv import load_dotenv

'''
    FastAPI 라이브러리에서 FastAPI 클래스를 가져오고
    파이썬으로 API 서버를 빠르게 만들 수 있게 해주는 도구
'''

from fastapi import FastAPI

'''
    CORS(Cross-Origin Resource Sharing) 미들웨어를 가져옵니다.
    미들웨어란 요청과 응답 사이에서 중간 처리를 담당하는 기능
    "다른 주소(포트)에서 오는 요청을 허용할지 말지"를 결정하는 보안 정책
'''

from fastapi.middleware.cors import CORSMiddleware

'''
    pydantic 라이브러리에서 BaseModel 클래스를 가져옵니다
'''

from pydantic import BaseModel
import os

#
from groq import Groq

# 같은 폴더에 있는 걸 로드
load_dotenv()

# https://console.groq.com/
GROQ_API_KEY = os.getenv("GROQ_API_KEY")

# 만약 설정이 안되어 있으면
if not GROQ_API_KEY:
    print("warning: .env 파일에서 API Key를 찾을 수 없습니다")

# 꺼내온 API 키로 Groq 클라이언트 생성
client = Groq(api_key=GROQ_API_KEY)

app = FastAPI()
'''
    fastapi 앱(서버) 인스턴스를 생성
'''

# app에 cors 미들웨어를 추가
app.add_middleware(
    CORSMiddleware, # 사용할 미들웨어 종류 지정
    allow_origins=["http://localhost:3000"], # 요청을 허용할 프론트 주소 목록 (ex. http://localhost:3000)
    allow_credentials=True, # 쿠키나 인증정보(credentials)를 요청에 포함하는 것을 허용
    allow_methods=["*"], # 허용할 http메서드를 지정
    allow_headers=["*"], # 허용할 http 헤더를 지정
)

# 프론트엔드에서 서버로 보내는 요청(req)데이터의 구조를 정의
class ChatRequest(BaseModel):
    message: str # 사용자가 입력하는 채팅 메시지를 받는 필드 str은 문자열 텍스트 타입

class ChatResponse(BaseModel):
    reply: str

'''
    /api/chat 경로로 post 요청이 들어왔을 때 실행 될 함수를 등록
'''
@app.post("/api/chat", response_model=ChatResponse)
# 실제 요청을 처리하는 비동기 함수 여러 요청을 동시에 효율적으로 처리
async def chat_endpoint(request: ChatRequest):
    # request 객체에서 사용자가 보낸 메시지 텍스트만 꺼내 변수에 저장
    user_message = request.message

    system_prompt = (
        "당신은 서울 노원구(노원역 문화의거리, 공릉동 경춘선숲길, 석계역, 수락산, 마들역, 중계역 등)의 "
        "맛집을 잘 아는 친절한 맛집 추천 AI 에이전트입니다. "
        "사용자가 질문을 하면 노원구 내의 실제 유명한 식당 이름, 위치, 대표 메뉴, "
        "분위기나 특징을 포함해 친근하고 보기 쉽게 답변해 주세요. "
        "반드시 완벽하고 자연스러운 한국어로만 답변하세요."
        "한 줄의 글자는 64글자 총 105 byte가 올 수 있으니 그 이후에는 다음줄로 넘겨 계속 작성해주세요"
        "친절함은 계속 유지해주세요 존댓말 사용 부탁드립니다"
    )

    try:
        print(f"사용자 질문 수신: {user_message} -> Groq 초고속 응답 요청 중…")

        chat_completion = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                # 1. 시스템 역할부여
                {"role": "system", "content": system_prompt},
                # 2. 사용자의 실제 질문 전달
                {"role": "user", "content": user_message},
            ],
            temperature=0.6
        )

        # ai가 생성한 답변 텍스트 꺼내기
        ai_reply = chat_completion.choices[0].message.content

        print("응답 완료")
    except Exception as e:
        print(f"Groq AI 호출 중 에러 발생: {e}")
        ai_reply = "죄송합니다. 현재 AI 응답을 가져오는 중 문제가 발생했습니다. .env 파일의 GROQ_API_KEY 설정이나 서버 콘솔을 확인해 주세요."

    # ChatResponse 객체를 생성해서 변환
    return ChatResponse(reply=ai_reply)



# 구동 명령어 uvicorn main:app --reload

# source .venv/bin/activate
# uvicorn main:app —reload —port 8000

# pip install openai langchain langchain-openai python-dotenv

# pip install groq