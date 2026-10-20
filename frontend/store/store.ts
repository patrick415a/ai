import { configureStore } from "@reduxjs/toolkit";
import chatReducer from './chatSlice'

export const store = configureStore({
  reducer: {
    chat: chatReducer,
  },
});

// typescript에서 사용할 RootState 및 AppDispatch 타입 정의
export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;