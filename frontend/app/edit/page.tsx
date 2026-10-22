'use client'

import React, { useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import { setInputText, setIsLoading, setShowMap, addMessage, setPlaces, setMobileView, setSelectedDistrict } from '@/store/chatSlice';
import ReactMarkdown from 'react-markdown';
import '@/assets/main.styles.scss'

// 무조건 시간 관련된 건 템포럴로
import { Temporal } from '@js-temporal/polyfill';

export default function Chat(){
  // redux 스토어에서 dispatch 함수 가져오기
  const dispatch = useDispatch<AppDispatch>();

  // redux 스토어의 상태(state)를 안전하게 구독(select)하여 가져오기
  const { message, inputText, isLoading, showMap, places, mobileView, selectedDistrict } = useSelector((state:RootState) => state.chat);

  const messagesEndref = useRef<HTMLDivElement>(null);

  // 새 메시지가 추가 될 때마다 가장 최신 메시지를 아래로 부드럽게 스크롤 이동
  useEffect(() => {
    messagesEndref.current?.scrollIntoView({
      behavior: 'smooth'
    })
  }, [message]);

  // 지도가 켜지면 모바일 뷰를 map으로 자동 변환
  useEffect(() => {
    if(showMap) dispatch(setMobileView('map'));
  }, [showMap, dispatch]);

  // [useCallback 훅] 사용자가 전송 버튼을 눌렀거나 엔터키를 칠 때 실행되는 비동기 전송 함수 불필요한 함수 재생성 방지
  const handleSend = useCallback(async () => {
    if(!inputText.trim()) return;
    const userQuery = inputText;
    const userMsgId = Temporal.Now.instant().epochMilliseconds;

    // 템포럴일 땐 다른 패턴으로 들어간다
    const newUserMessages = {
      id: userMsgId,
      text: userQuery,
      sender: 'user' as const,
    }

    // redux 액션을 통해 화면에 사용자 메시지 추가 및 입력창 초기화, 로딩 시작
    dispatch(addMessage(newUserMessages));
    dispatch(setInputText(''));
    dispatch(setIsLoading(true));

    // [지능형 분기 처리] 질문 내용에 있는 장소
    // 관련 키워드가 포함되어 있는지 검사
    const lowerQuery = userQuery.toLowerCase();
    const isLocationQuery = 
      lowerQuery.includes("맛집") ||
      lowerQuery.includes("학원") ||
      lowerQuery.includes("식당") ||
      lowerQuery.includes("카페") ||
      lowerQuery.includes("추천") ||
      lowerQuery.includes("극장") ||
      lowerQuery.includes("근처");

      // 장소 관련 질문이면 지도 창을 활성화 하고 아니면 숨김
      dispatch(setShowMap(isLocationQuery));

      try {
        const response = await fetch('http://localhost:8000/api/chat', {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({message: userQuery})
        });

        if(!response.ok) throw new Error('서버 에러가 발생하였습니다');
        
        const data = await response.json();

        // ai 응답 시점에 새로운 temporal 타임 스탬프를 생성하여 ID 중복 방지
        // sql에서 중복을 제거하는 대표적인 방법은 조회시 중복제거 distinct
        const aiMsgId = Temporal.Now.instant().epochMilliseconds;

        // 백엔드에서 받은 데이터 redux 상태에 추가
        dispatch(addMessage({
          id: aiMsgId,
          text: data.reply,
          sender: 'ai'
        }));

        // 지도 표시 여부, 장소 목록 redux 반영
        if(typeof data.show_map === 'boolean'){
          dispatch(setShowMap(data.show_map || isLocationQuery));
        }

        // array인지 확인
        if(Array.isArray(data.places)){
          dispatch(setPlaces(data.places || []));
        }
      }catch(e){
        console.error('통신 에러가 발생하였습니다', e);
        const errorMsgId = Temporal.Now.instant().epochMilliseconds;

        dispatch(addMessage({
          id: errorMsgId,
          text: '서버 에러가 발생하였습니다. 다시 시도해주세요',
          sender: 'ai'
        }));

        // 내가 추가 [필요한지 아닌지는 모름]
        // dispatch(setShowMap(false));
        // dispatch(setPlaces([]));
      }finally{
        dispatch(setIsLoading(false));
      }
  }, [inputText, dispatch]);

  /* 
    useCallback 훅 적용
    키보드 엔터 입력 시 handleSend를 호출하도록 최적화 된 콜백 함수
  */
  const handleKeyPress = useCallback((e:React.KeyboardEvent<HTMLInputElement>) => {
    if(e.key == 'Enter' && !isLoading) return handleSend();
  }, [handleSend, isLoading]);

  return (
    <>
      <div id="wrap">
        <header>
          <div className='brand'>
            <img src="/avatar.png" alt="누비니" />
            누비니
          </div>
          <div className='area'>
            <svg className='map-icon' viewBox="0 0 24 24">
              <path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z"></path>
              <circle cx="12" cy="10" r="2.5"></circle>
            </svg>
            {/* 지역 */}
            <div className='city'>
              <select name="area" className="area-select">
                <option value="노원구">노원구</option>
                <option value="도봉구">도봉구</option>
                <option value="강북구">강북구</option>
                <option value="중랑구">중랑구</option>
                <option value="성북구">성북구</option>
              </select>
              <svg viewBox="0 0 24 24"><path d="m6 9 6 6 6-6"></path></svg>
            </div>
          </div>
        </header>
        <section>
          <article className='chat'>
            <div className='message'>
              <div className='banner'>
                <img src="/banner.png" alt="banner" />
                <div className='copy'>
                  <h1>
                    우리 동네의<br/> 좋은 장소를 <strong>누비니</strong>와 함께 찾아보세요
                  </h1>
                  <p>
                    선택한 지역의 맛집, 카페, 학원, 문화시설까지<br/>
                    원하는 장소를 대화로 편하게 찾아보세요
                  </p>
                </div>
              </div>

              {/* 아무것도 입력 안했을 시 예시 */}
              <div className='empty-text'>
                <img src="/avatar.png" alt="누비니" />
                <h3>
                  안녕하세요! <strong>누비니</strong>예요. <br/>
                  오늘은 어떤 장소를 찾고 계신가요?
                </h3>
                <p>
                  지역을 선택하고 원하는 조건을 말해 주세요! <br/>
                  새로운 장소를 함께 찾아드릴게요!
                </p>
                <div className='help-button'>
                  <button type="button">
                    <svg viewBox="0 0 24 24"><path d="M4 3v7c0 2 4 2 4 0V3M6 3v18M17 3c-3 4-4 8-4 11h4v7"></path></svg>
                    점심 메뉴 추천
                  </button>
                  <button type="button">
                    <svg viewBox="0 0 24 24"><path d="M3 8h13v7a6 6 0 0 1-12 0V8ZM16 9h2a3 3 0 1 1 0 6h-2"></path><path d="M8 2v3m4-3v3"></path></svg>
                    조용한 카페 찾기
                  </button>
                  <button type="button">
                    <svg viewBox="0 0 24 24"><path d="m2 9 10-5 10 5-10 5L2 9Z"></path><path d="M6 11v5c4 3 8 3 12 0v-5M22 9v7"></path></svg>
                    근처 수학 학원
                  </button>
                </div>
              </div>

              {/* 채팅 예시 */}
              <div className='user chat-result'>
                <div className='chat-bubble'>
                  <ReactMarkdown>노원구 맛집 찾아줘</ReactMarkdown>
                </div>
                <div className='chat-icon'>
                  <svg viewBox="0 0 24 24">
                    <circle cx="12" cy="6" r="5"></circle>
                    <path d="M4 21v-2a8 8 0 0 1 16 0v2"></path>
                  </svg>
                </div>
              </div>
              <div className='ai chat-result'>
                <div className='chat-icon'>
                  <img src="/avatar.png" alt="ai" />
                </div>
                <div className='chat-bubble'>
                  <ReactMarkdown>
                    배고프시군요! 노원구에서 인기 있는 맛집 세 곳을 소개해 드릴게요. 🍽️ 
                    1️⃣ 노원동 순두부찌개 – 부드러운 순두부와 진한 국물이 일품이에요. 
                    2️⃣ 공릉동 베트남쌀국수 – 깔끔하고 시원한 쌀국수, 점심 메뉴로 최고! 
                    3️⃣ 석계역 삼겹살 – 두툼한 삼겹살에 특제 소스가 곁들여진 고기집이에요. 
                    각 장소는 지도에 표시해 두었으니 편하게 찾아가 보세요!
                  </ReactMarkdown>
                </div>
              </div>

              <div className='ai chat-result'>
                <div className='chat-icon'>
                  <img src="/avatar.png" alt="ai" />
                </div>
                <div className='chat-bubble'>
                  최적의 장소 분석 중...
                </div>
              </div>
            </div>
            <form className='submit-form' onSubmit={(e: React.FormEvent) => e.preventDefault()}>
              <input type="text" className='question' name="question" placeholder='궁금한 장소나 조건을 입력해보세요. 예) 분위기 좋은 카페' />
              <button type="button">
                <svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"></path></svg>
              </button>
            </form>
          </article>
          <article className='map d-none'>

          </article>
        </section>
      </div>
    </>
  )
}

