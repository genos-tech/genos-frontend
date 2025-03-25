import { useState, useEffect } from "react";
import { CssVarsProvider } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';
import ChatHome from './components/chatHome';
import './App.css';
import Loading from './components/utils/loading'
import {
  UserProps,
  ChatProps,
} from "./types";
import { SocketProvider } from "./components/utils/socketContext";

const myself: UserProps = {
  userName: localStorage.getItem("userName") || "",
  userEmail: localStorage.getItem("userEmail") || "",
  avatarImgPath: "/path/to/user/Origin.jpg",
  online: true,
};

function App() {
  const [isLoading, setIsLoading] = useState(true);
  const [currentMainChat, setCurrentMainChat] = useState<ChatProps>();

  return (
    (isLoading
      || currentMainChat === undefined
    ) ?
      <Loading
        myself={myself}
        setIsLoading={setIsLoading}
        setCurrentMainChat={setCurrentMainChat}
      />
      : <CssVarsProvider disableTransitionOnChange>
        <CssBaseline />

        <ChatHome
          myself={myself}
          currentMainChat={currentMainChat}
          setCurrentMainChat={setCurrentMainChat}
        />

      </CssVarsProvider>
  )
}

export default App
