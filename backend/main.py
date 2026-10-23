'''
    pip install fastapi uvicorn pydantic
    python.exe -m pip install --upgrade pip

    fastapi: 빠르고 간편한 파이선 프레임워크
    uvicorn: 서버를 실행 시켜주는 도구
    pydantic: 프론트엔드에서 넘어온 메시지 형식이 맞는지 검사
'''

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

# ai가 보내준 json 문자열 데이터를 파이썬 딕셔너리로 변환
import json

# 리스트나 선택적 값 같은 데이터 타입을 명확히 지정하기 위해 타이핑 모듈을 가져온다
from typing import List, Optional

from pathlib import Path

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
    district: str # 사용자가 선택한 지역

# 다음 카카오 맵의 마커 아이콘을 찍기 위해 개별 장소의 데이터 구조를 정의
class PlaceInfo(BaseModel):
    name: str
    category: str
    address: str
    lat: float
    lng: float
    is_registered: bool
    description: str

class ChatResponse(BaseModel):
    reply: str
    # 프론트엔드가 지도를 화면에 띄울지 말지 결정하는 상태 값
    show_map: bool = False
    # 지도에 표시할 맛집/학원 장소들의 배열 데이터
    places: List[PlaceInfo] = []

'''
    /api/chat 경로로 post 요청이 들어왔을 때 실행 될 함수를 등록
'''
@app.post("/api/chat", response_model=ChatResponse)
# 실제 요청을 처리하는 비동기 함수 여러 요청을 동시에 효율적으로 처리
async def chat_endpoint(request: ChatRequest):
    # request 객체에서 사용자가 보낸 메시지 텍스트만 꺼내 변수에 저장
    user_message = request.message
    user_district = request.district

    system_prompt = (
        f"당신은 서울 {user_district} 지역의 장소를 잘 아는 친절한 장소 추천 AI 에이전트 누비니입니다"
        "사용자가 질문을 하면 지역 내의 실제 유명한 식당 이름, 위치, 대표 메뉴, "
        "분위기나 특징을 포함해 친근하고 보기 쉽게 답변해 주세요. "
        "반드시 완벽하고 자연스러운 한국어로만 답변하세요."
        """
            [답변 작성 및 줄바꿈 규칙]
        
            1. 사용자가 읽기 편하도록 답변을 문단별로 구분하세요.
            2. 서로 다른 주제나 설명은 반드시 빈 줄로 구분하세요.
            3. 장소를 여러 개 추천할 경우 번호가 있는 마크다운 목록을 사용하세요.
               장소는 기본적으로 3곳을 추천하고, 사용자의 요청이 있을 때(예시: n곳 추천해줘) 최대 7건 이하로 추천해주세요
            4. 각 장소의 이름, 위치, 대표 메뉴, 특징을 보기 좋게 구분하세요.
            5. 각 장소의 설명이 끝나면 빈 줄을 넣으세요.
            6. 긴 문장은 적절한 길이로 나누되, 문장 중간에서
               무리하게 줄바꿈하지 마세요.
            7. 한 문단은 가급적 2~3문장을 넘지 않도록 작성하세요.
            8. JSON의 reply 문자열에 줄바꿈이 필요한 경우
               JSON 이스케이프 문자 \\n을 사용하세요.
            9. 친근하고 자연스러운 존댓말을 유지하세요.
        
            위 규칙은 모든 답변에 적용합니다.
        """
        "친절함은 계속 유지해주세요 존댓말 사용 부탁드립니다."
        "응답은 반드시 아래의 JSON 형식으로만 작성해야 합니다:\n"
        "{\n"
            '"reply": "사용자에게 보여줄 친절한 답변 (마크다운 문법 사용 가능)",\n'
            '"show_map": true 또는 false (맛집, 학원, 카페, 식당, 장소 추천 등 지도가 필요한 질문이면 true, 일반 대화면 false),\n'
            '"places": [\n'
                "{\n"
                    '"name": "업체명", \n'
                    '"category": "맛집 또는 학원 등 카테고리", \n'
                    '"address": "상세 주소", \n'
                    '"lat": 37.6551 (실제 해당 지역의 대략적인 위도 숫자), \n'
                    '"lng": 127.0614 (실제 해당 지역의 대략적인 경도 숫자), \n'
                    '"is_registered": true 또는 false (유명 프랜차이즈나 다음맵에 등록된 유명 업체면 true, 숨은 골목식당이나 가상의 추천/미등록 업체면 false), \n'
                    '"description": "대표 메뉴나 학원 특징 요약" \n'
                "}\n"
            "]\n"
        "}\n"
        "주의: 일반 대화(show_map이 false일 때)인 경우 places를 빈 배열 []로 보내세요"
    )

    # 에러가 발생했을 때를 대비해 기본 반환값 변수를 미리 초기화 해 둡니다
    show_map_flag = False
    places_list = []

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
            temperature=0.6,
            # json 형태로만 답하도록 설정
            response_format={"type":"json_object"},
        )

        # ai가 생성한 답변 텍스트 꺼내기
        raw_content = chat_completion.choices[0].message.content
        print("Grog 응답 완료")

        # [추가] AI가 보내준 JSON 문자열을 파이썬 딕셔너리 객체로 변환
        parsed_data = json.loads(raw_content)

        # 파싱된 데이터에서 답변, 지도 표시여부, 장소 목록을 안전하게 꺼내기
        ai_reply = parsed_data.get("reply", "답변을 생성하지 못하였습니다")
        show_map_flag = parsed_data.get("show_map", False)
        places_list = parsed_data.get("places", [])

    except Exception as e:
        print(f"Groq AI 호출 중 에러 발생: {e}")
        ai_reply = "죄송합니다. 현재 AI 응답을 가져오는 중 문제가 발생했습니다. .env 파일의 GROQ_API_KEY 설정이나 서버 콘솔을 확인해 주세요."
        show_map_flag = False
        places_list = []

    # ChatResponse 객체를 생성해서 변환
    return ChatResponse(reply=ai_reply, show_map=show_map_flag, places=places_list)

# 구동 명령어 uvicorn main:app --reload

# source .venv/bin/activate
# uvicorn main:app --reload --port 8000

# pip install openai langchain langchain-openai python-dotenv

# pip install groq