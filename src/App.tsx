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

type SetMyselfProps = {
  myself: UserProps;
  setMyself: (me: UserProps) => void;
}

const useMyself = (): SetMyselfProps => {
  const [myself, setMyself] = useState<UserProps>({
    teamId: "",
    userId: "",
    userName: "",
    userEmail: "",
    avatarImgPath: "/path/to/user/Origin.jpg",
    online: true,
  });

  useEffect(() => {
    const fetchUserData = () => {
      setMyself({
        teamId: localStorage.getItem("teamId") || "",
        userId: localStorage.getItem("userId") || "",
        userName: localStorage.getItem("userName") || "",
        userEmail: localStorage.getItem("userEmail") || "",
        avatarImgPath: "/path/to/user/Origin.jpg",
        online: true,
      });
    };

    // Add a small delay to ensure localStorage is updated
    setTimeout(fetchUserData, 50);

    // Listen for storage updates in case another tab updates it
    window.addEventListener("storage", fetchUserData);

    return () => {
      window.removeEventListener("storage", fetchUserData);
    };
  }, []);

  return { myself, setMyself };
};

function App() {
  const { myself, setMyself } = useMyself();
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
          setMyself={setMyself}
          currentMainChat={currentMainChat}
          setCurrentMainChat={setCurrentMainChat}
        />

      </CssVarsProvider>
  )
}

export default App
