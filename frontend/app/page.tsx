'use client'

import React, { useRef, useEffect, useCallback } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { RootState, AppDispatch } from '@/store/store';
import { setInputText, setIsLoading, setShowMap, addMessage, setPlaces } from '@/store/chatSlice';
import ReactMarkdown from 'react-markdown';

// 무조건 시간 관련된 건 템포럴로
import { Temporal } from '@js-temporal/polyfill';

export default function Chat(){
  // redux 스토어에서 dispatch 함수 가져오기
  const dispatch = useDispatch<AppDispatch>();

  // redux 스토어의 상태(state)를 안전하게 구독(select)하여 가져오기
  const { message, inputText, isLoading, showMap, places } = useSelector((state:RootState) => state.chat);

  const messagesEndref = useRef<HTMLDivElement>(null);

  // 새 메시지가 추가 될 때마다 가장 최신 메시지를 아래로 부드럽게 스크롤 이동
  useEffect(() => {
    messagesEndref.current?.scrollIntoView({
      behavior: 'smooth'
    })
  }, [message]);

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
      <div className="flex justify-center items-center min-h-screen bg-slate-100 p=0 sm:p-4">
        {/*
          showMap이 true일 때는 너비를 넓혀서(max-w-[1200px]) 지도와 채팅이 나란히 들어가게 하고
          false(일반 채팅)일 때는 컴팩트하게(max-w-[800px]) 유지합니다.
        */}
        <div className={`w-full h-screen sm:h-[88vh] bg-white shadow-2xl rounted-none sm:rounded-2xl flex flex-col overflow-hidden border border-slate-200 transition-all duration-300 ${showMap ? 'max-w-[1200px]' : 'max-w-[800px]'}`}>
          {/* 상단 */}
          <header className='flex justify-between items-center px-6 py-4 bg-indigo-600 text-white shadow-md shrink-0'>
            <div className="flex items-center gap-x-3">
              <span className='text-2xl'>🤖</span>
              <h1 className='text-lg sm:text-xl font-bold tracking-tight'>노원구 맛집 & 학원 and so on</h1>
            </div>

            {/* 현재 상태를 알려주는 상단 상태 뱃지 */}
            <div className="text-xs bg-indigo-700 p-3 py-1.5 rounded-full font-medium shadow-inner">
              {showMap ? "🗺️ 지도 모드 활성화 됨" : "💬 일반 채팅 모드"}
            </div>
          </header>

          {/* 중앙 바디 영역 */}
          <div className="flex-1 flex flex-col sm:flex-row overflow-hidden bg-slate-50">
          
            {/* 1) 채팅 영역 (항상 표시됨) */}
            <div className={`flex-1 flex flex-col h-full overflow-hidden ${showMap ? "sm:w-1/2 border-r border-slate-200" : "w-full"}`}>
              
              {/* 대화 내용 스크롤 박스 */}
              <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4">
                {message.map((msg) => (
                  <div
                    key={msg.id}
                    className={`flex items-end space-x-2 ${
                      msg.sender === "user" ? "justify-end" : "justify-start"
                    }`}
                  >
                    {/* AI 프로필 아바타 */}
                    {msg.sender === "ai" && (
                      <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 shadow-sm">
                        <span className="text-indigo-600 text-sm font-bold">AI</span>
                      </div>
                    )}

                    {/* 메시지 말풍선 (마크다운 렌더링 지원) */}
                    <div
                      className={`max-w-[80%] sm:max-w-[75%] px-4 py-3 rounded-2xl text-sm sm:text-base leading-relaxed shadow-sm ${
                        msg.sender === "user"
                          ? "bg-indigo-600 text-white rounded-br-none"
                          : "bg-white text-slate-800 border border-slate-200 rounded-bl-none"
                      }`}
                    >
                      <div className="prose prose-sm max-w-none">
                        <ReactMarkdown>{msg.text}</ReactMarkdown>
                      </div>
                    </div>
                  </div>
                ))}

                {/* AI가 응답을 생성하는 동안 보여주는 로딩 애니메이션 */}
                {isLoading && (
                  <div className="flex items-end space-x-2 justify-start">
                    <div className="w-9 h-9 rounded-full bg-indigo-100 flex items-center justify-center shrink-0 shadow-sm">
                      <span className="text-indigo-600 text-sm font-bold">AI</span>
                    </div>
                    <div className="bg-white border border-slate-200 px-4 py-3 rounded-2xl rounded-bl-none shadow-sm flex items-center space-x-2">
                      <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.3s]"></div>
                      <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce [animation-delay:-0.15s]"></div>
                      <div className="w-2.5 h-2.5 bg-indigo-600 rounded-full animate-bounce"></div>
                      <span className="text-xs text-slate-500 ml-1 font-medium">생각하는 중...</span>
                    </div>
                  </div>
                )}
                <div ref={messagesEndref} />
              </div>

              {/* 하단 메시지 입력 폼 */}
              <div className="p-4 bg-white border-t border-slate-200 flex items-center space-x-3 shrink-0">
                <input
                  type="text"
                  className="flex-1 bg-slate-100 border border-slate-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:bg-white transition"
                  placeholder="예: 노원구 맛집 추천해줘 / 파이썬 학원 알려줘..."
                  value={inputText}
                  onChange={(e) => dispatch(setInputText(e.target.value))}
                  onKeyPress={handleKeyPress}
                />
                <button
                  onClick={handleSend}
                  disabled={isLoading}
                  className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-300 text-white px-5 py-3 rounded-xl text-sm font-semibold transition shadow-sm shrink-0 cursor-pointer"
                >
                  전송
                </button>
              </div>
            </div>

            {/* 2) 다음맵(카카오맵) 연동 영역 (맛집/학원 등 장소 검색 질문일 때만 화면에 나타남) */}
            {showMap && (
              <div className="w-full sm:w-1/2 h-80 sm:h-full bg-slate-100 relative flex flex-col p-6 border-t sm:border-t-0 sm:border-l border-slate-200 overflow-y-auto">
                {/* 상단 지도 헤더 및 닫기 버튼 */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl">🗺️</span>
                    <h3 className="text-base font-bold text-slate-800">
                      다음맵(카카오맵) 장소 마커 목록
                    </h3>
                  </div>
                  <button
                    onClick={() => dispatch(setShowMap(false))}
                    className="bg-slate-700 hover:bg-slate-800 text-white px-3 py-1.5 rounded-lg text-xs font-medium transition shadow cursor-pointer"
                  >
                    지도 닫기
                  </button>
                </div>
                {/* 마커범례 안내 (다음 맵 등록 || 미등록 아이콘) */}
                <div className="flex space-x-4 mb-4 p-3 bg-white rounded-xl border border-slate-200 text-xs text-slate-600 shadow-sm">
                  
                  <div className="flex items-center space-x-1.5">
                    <span className='text-base'>🔵</span>
                    <span className='font-semibold text-blue-700'>다음 맵 등록 업체 (공식 핀)</span>
                  </div>

                  <div className="flex items-center space-x-1.5">
                    <span className='text-base'>🟠</span>
                    <span className='font-semibold text-orange-700'>미등록/AI 추천 업체 (커스텀 아이콘)</span>
                  </div>
                </div>

                {/* 백엔드에서 받아온 places 배열 데이터 기반으로 등록 */}
                <div className="flex-1 space-y-3">
                  {places.length > 0 ? 
                    places.map((place, index) => (
                      <div className="p-4 bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-md transition flex items-start space-x-3 text-left" key={index}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 text-lg shadow-sm ${place.is_registered ? 'bg-blue-100 text-blue-600 border border-blue-300' : 'bg-orange-100 text-orange-600 border border-orange-300'}`}>
                          {place.is_registered ? "🔵" : "🟠"}
                        </div>
                      </div>
                    ))
                    : (
                    <></>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  )
}