/* 
  Nextjs 13버전 이상에서 이 파일이 클라이언트(브라우저) 측에서 실행되는 컴포넌트임을 명시
*/

// 경로 옮기면서 에러 떴는데 터미널에 rmdir /s /q .next 이거 쓰니까 사라졌다 (캐시폴더 지우기)

"use client";

// 리액트 라이브러리에서 기본 기능과 상태관리(useState), 참조(useRef), 생명주기(useEffect)
import React, {useState, useRef, useEffect} from 'react';
// material design for bootstrap
import {
  MDBContainer,
  MDBCard,
  MDBCardHeader,
  MDBCardBody,
  MDBCardFooter,
  MDBIcon,
  MDBBtn,
  MDBSpinner
} from 'mdb-react-ui-kit';

import ReactMarkdown from "react-markdown";

// 메시지 타입 정의
/*
  typescript를 사용하여 message라는 데이터 형태 타입 지정
  이렇게 하면 코드 작성 중 실수를 방지할 수 있다
*/
interface Message {
  id: number;
  text: string;
  sender: 'user' | 'ai';
}

export default function Home(){
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false); // 로딩상태 추가 (ai 답변을 대기하는 상태를 표현)
  const [message, setMessage] = useState<Message[]>([ // 채팅상태 배열 저장
    // 화면이 처음 켜졌을 때 보여줄 기본 ai 인사말
    {id: 1, text: "안녕하세요! 무엇이든 물어보실 수 있는 AI 어시스턴트입니다. 무엇을 도와드릴까요?", sender: "ai"}
  ]);

  /*
    채팅이 길어질때 가장 최신 메시지 자동 스크롤하기 위해 참조를 이용
  */
  const messageEndRef = useRef<HTMLDivElement>(null);

  /*
    특정 상황에서 자동으로 실행되는 함수 useEffect
  */
  useEffect(() => {
    messageEndRef.current?.scrollIntoView({behavior: 'smooth'});
  }, [message]);

  // 사용자가 전송 버튼을 누르거나 엔터키 쳤을 때 실행되는 비동기 함수
  const handleSend = async () => {
    if(!inputText.trim() || isLoading) return; // 공백 제거 시 아무 글자 없다면 함수 종료, 추가로 전송 버튼 눌렀을 때 로딩중이라면 취소

    // 사용자 메시지 추가
    const newUserMessage: Message = {
      id: Date.now(),
      text: inputText,
      sender: 'user'
    };
    setMessage((prev) => [...prev, newUserMessage]); // 화면 업데이트
    setInputText(""); // 입력창 비우기
    setIsLoading(true); // API 응당 대기 상태로 변경

    // 여기에 추후 파이썬 백엔드 api가 들어갈 예정
    try {
      // 파이썬 백엔드 서버로 데이터를 보냅니다 (POST)
      // fetch 네트워크 통신을 담당하고, await을 써서 응답이 올 때까지 기다림
      const response = await fetch('http://localhost:8000/api/chat', {
        method: 'POST',
        headers: {
          "Content-Type": "application/json"
        },
        // 자바스크립트 객체를 json 문자열로 보냅니다
        body: JSON.stringify({message: newUserMessage.text})
      });

      if(!response.ok){
        throw new Error("서버 에러가 발생했습니다");
      }

      // 서버에서 온 응답 데이터를 자바스크립트 객체로 변환
      const data = await response.json(); 

      // 백엔드 답변을 이용해 ai 메시지 객체를 만들고 화면에 추가
      setMessage((prev) => [
        ...prev,
        { id: Date.now(), text : data.reply, sender: 'ai'}
      ]);
    }catch (error) {
      // 통신 중 에러 (서버 꺼짐, 인터넷 끊김등)가 발생하면 콘솔에 에러를 출력
      console.error('통신 에러');
      setMessage((prev) => [
        ...prev,
        { id: Date.now(), text : '백엔드 서버와 연결할 수 없습니다 (8000 서버를 확인해주세요)', sender: 'ai'}
      ]);
    } finally {
      setIsLoading(false);
    }

    // 임시 AI 응답 (나중에 백엔드 연동 후 삭제)
    // setTimeout(() => {
    //   setMessage((prev) => [
    //     ...prev, {id: Date.now(), text: "백엔드 연결 전입니다. 조금만 기다려 주세요", sender: 'ai'}
    //   ])
    // }, 1000);
  };

  // 사용자가 입력창에 키보드를 누를 때 실행되는 함수
  const handleKeepPress = (e:React.KeyboardEvent<HTMLInputElement>) => {
    // 누른키가 엔터일 때 실행 (단 loading중이 아닐 때 -> 난 이거를 handleSend로 변경)
    if(e.key === 'Enter') {
      handleSend();
    }
  }

  return (
    <MDBContainer fluid className='p-4' style={{maxWidth: '800px'}}>
      <MDBCard style={{borderRadius: '15px', height: '80vh', display: 'flex', flexDirection: 'column'}}>
        {/* header 영역 */}
        <MDBCardHeader className='d-flex justify-content-between align-items-center p-3 text-white' style={{borderTopLeftRadius: '15px', borderTopRightRadius: '15px'}}>
          <div className="d-flex align-items-center">
            <MDBIcon fas icon='robot' size='lg' className='me-2' />
            <h5 className="mb-0 fw-bold">노원구 맛집 AI</h5>
          </div>

          <MDBIcon fas icon='utensils' size='lg' />
        </MDBCardHeader>

        {/* 채팅 내용 영역 */}
        <MDBCardBody
          style={{overflowY:"auto", flex:1, backgroundColor:"#f9fbfd"}}
          >
          {message.map((msg) => (
          <div
            key={msg.id}
            className={`d-flex flex-row justify-content-${msg.sender === "user" ? "end":"start"}`}
          >
          {msg.sender === "ai" &&(
              <div style={{width:"45px", height:"100%"}} className="me-2 text-center">
                  <MDBIcon fas icon="robot" size="2x" style={{color:"#3f51b5"}}/>
              </div>
          )}
          <div
          className="p-3"
            style={{
            borderRadius:"15px",
            backgroundColor:msg.sender === "user" ? "#3f51b5" : "#e0e0e0",
            color:msg.sender === "user" ? "white" : "black",
            maxWidth:"70%",
            }}
          >
            {/* <p className="small mb-0" style={{lineHeight:"1.5", whiteSpace: "pre-wrap"}}>
              {msg.text}
            </p> */}

            <ReactMarkdown>
              {msg.text}
            </ReactMarkdown>
          </div>

          </div>
          ))}

          { /* 로딩상태(isLoading이 true)일 때 화면에 보여주는 "생각하는 중" */ }
          {isLoading && (
            <div className="d-flex flex-row justify-content-start">
              <div style={{width: '45px', height: '100%'}} className='me-2 text-center'>
                <MDBIcon fas icon="robot" size='2x' style={{color: '#3f51b5'}} />
              </div>
              <div className="p-3" style={{borderRadius: '15px', backgroundColor: '#e0e0e0'}}>
                <MDBSpinner size='sm' rol='status' tag='span' />
                <span className='ms-2 small'>생각 하는 중</span>
              </div>
            </div>
          )}

          {/* 사용자가 새 메시지를 쓸 때마다 */}
          <div ref={messageEndRef} />
          </MDBCardBody>

        {/* 입력 영역 */}
        <MDBCardFooter className='text-muted d-flex justify-content-start align-items-center p-3'>
          <input 
            type="text" 
            className='form-control form-control-lg py-0' placeholder='메시지를 입력해주세요' 
            value={inputText} 
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeepPress}
            style={{borderRadius: '10px'}}
          />
          <MDBBtn type='button' color='primary' className='ms-3 text-nowrap' style={{borderRadius: '10px'}} onClick={handleSend} noRipple disabled={isLoading}>
            <MDBIcon fas icon="paper-plane" className='me-2' /> 전송
          </MDBBtn>
        </MDBCardFooter>
      </MDBCard>
    </MDBContainer>
  );
}