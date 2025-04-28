import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { CssVarsProvider } from '@mui/joy/styles';
import CssBaseline from '@mui/joy/CssBaseline';

import './App.css';
import { ChatHome } from './features/chat/chatHome';
import { TaskHome } from './features/tasks/taskHome';
import { NoteHome } from './features/notes/NoteHome';
import { Loading } from './services/loading'
import { UserProps } from "./types/admin";
import { ChatProps } from "./types/chat";
import { useAuth } from "./context/AuthContext";

type SetMyselfProps = {
  myself: UserProps;
  setMyself: (me: UserProps) => void;
}

const ws_url = import.meta.env.VITE_WS_BASE_URL;
const socket = (accessToken: string | null): Socket => {
  return io(ws_url, {
    reconnection: true,          // Enable reconnection
    reconnectionAttempts: 5,     // Try to reconnect 5 times
    reconnectionDelay: 1000,     // Wait 1 second before reconnecting
    reconnectionDelayMax: 5000,  // Max delay between reconnection attempts
    timeout: 10000,              // Timeout for the connection attempt
    withCredentials: true,
    query: {
      teamId: localStorage.getItem("teamId"),
      userId: localStorage.getItem("userId"),
      userName: localStorage.getItem("userName"),
      userEmail: localStorage.getItem("userEmail"),
    },
    extraHeaders: {
      Authorization: accessToken || ""
    },
  });
};

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

export const App = () => {
  const { accessToken } = useAuth();
  const { myself, setMyself } = useMyself();
  const [isLoading, setIsLoading] = useState(true);
  const [currentMainChat, setCurrentMainChat] = useState<ChatProps | undefined>(undefined);

  // {1: Chat, 2: Tasks, 3: Notes}
  const [openingService, setOpeningService] = useState<number>(2);

  const [socketInstance, setSocketInstance] = useState<Socket | null>(null);

  useEffect(() => {
    if (accessToken) {
      setSocketInstance(socket(accessToken));
    }
  }, [accessToken]);

  return (
    isLoading || currentMainChat === undefined ? (
      <Loading
        myself={myself}
        setIsLoading={setIsLoading}
        setCurrentMainChat={setCurrentMainChat}
      />
    ) : (
      <div className="main-container">

        <CssVarsProvider disableTransitionOnChange>
          <CssBaseline />

          {openingService === 1 ? (
            <ChatHome
              socket={socketInstance}
              myself={myself}
              setMyself={setMyself}
              currentMainChat={currentMainChat}
              setCurrentMainChat={setCurrentMainChat}
              setOpeningService={setOpeningService}
            />
          ) : null}

          {openingService === 2 ? (
            <TaskHome
              socket={socketInstance}
              myself={myself}
              setMyself={setMyself}
              setOpeningService={setOpeningService}
            />
          ) : null}

          {openingService === 3 ? (
            <NoteHome
              socket={socketInstance}
              myself={myself}
              setMyself={setMyself}
              setOpeningService={setOpeningService}
            />
          ) : null}

        </CssVarsProvider>
      </div>

    )
  );
}
