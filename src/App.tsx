import { useState, useEffect } from "react";
import { io, Socket } from "socket.io-client";
import { CssVarsProvider } from "@mui/joy/styles";
import CssBaseline from "@mui/joy/CssBaseline";

import "./App.css";
import { ChatHome } from "./features/chat/chatHome";
import { TaskHome } from "./features/tasks/taskHome";
import { NoteHome } from "./features/notes/NoteHome";
import { InitialLoad } from "./components/utils/InitialLoad";
import { UserProps } from "./types/admin";
import { ActivityMessageProps, AllChatProps, ChatProps, ThreadProps } from "./types/chat";
import { useAuth } from "./context/AuthContext";
import { wsHook } from "./hooks/wsHook";
import { popInboxItems } from "./features/inbox/services/popInboxItems";
import { popAllChats } from "./features/chat/services/popAllChats";
import { popActivityMessages } from "./features/chat/services/popActivityMessages";
import { popTeamMembers } from "./features/chat/services/popTeamMembers";
import { initDB } from "./db/schema";
import { InboxHome } from "./features/inbox/inboxHome";
import { InboxProps } from "./types/common";

type SetMyselfProps = {
    myself: UserProps;
    setMyself: (me: UserProps) => void;
};

const ws_url = import.meta.env.VITE_WS_BASE_URL;
const socket = (accessToken: string | null): Socket => {
    return io(ws_url, {
        reconnection: true, // Enable reconnection
        reconnectionAttempts: 5, // Try to reconnect 5 times
        reconnectionDelay: 1000, // Wait 1 second before reconnecting
        reconnectionDelayMax: 5000, // Max delay between reconnection attempts
        timeout: 10000, // Timeout for the connection attempt
        withCredentials: true,
        query: {
            teamId: localStorage.getItem("teamId"),
            userId: localStorage.getItem("userId"),
            userName: localStorage.getItem("userName"),
            userEmail: localStorage.getItem("userEmail"),
        },
        extraHeaders: {
            Authorization: accessToken || "",
        },
    });
};

const useMyself = (): SetMyselfProps => {
    const [myself, setMyself] = useState<UserProps>({
        teamId: "",
        teamName: "",
        userId: "",
        userName: "",
        userEmail: "",
        avatarImgPath: "",
        online: true,
    });

    useEffect(() => {
        const fetchUserData = () => {
            setMyself({
                teamId: localStorage.getItem("teamId") || "",
                teamName: localStorage.getItem("teamName") || "",
                userId: localStorage.getItem("userId") || "",
                userName: localStorage.getItem("userName") || "",
                userEmail: localStorage.getItem("userEmail") || "",
                avatarImgPath: localStorage.getItem("avatarImgPath") || "",
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
    // Need to run if you delete IndexedDB database
    initDB();

    const { accessToken } = useAuth();
    const { myself, setMyself } = useMyself();
    const [teamMembers, setTeamMembers] = useState<UserProps[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isWSConnected, setIsWSConnected] = useState(false);
    const [currentMainChat, setCurrentMainChat] = useState<ChatProps | undefined>(undefined);

    // {0: Inbox, 1: Chat, 2: Tasks, 3: Notes}
    const [openingService, setOpeningService] = useState<number>(
        Number(localStorage.getItem("openingService") || "1")
    );

    // {1: DM, 2: GM, 3: PM, 4: Pin, 5: Activity}
    const [currentChatPaneType, setCurrentChatPaneType] = useState<number>(
        Number(localStorage.getItem("currentChatPaneType") || "1")
    );

    const [socketInstance, setSocketInstance] = useState<Socket | null>(null);
    const [currentSubChat, setCurrentSubChat] = useState<ChatProps>();
    const [currentThreadChat, setCurrentThreadChat] = useState<ThreadProps>();
    const [isTaskCommentUpdated, setIsTaskCommentUpdated] = useState(false);
    const [inboxItems, setInboxItems] = useState<InboxProps[]>([]);
    const funcSetInboxItems = async () => {
        const inboxItems: InboxProps[] = await popInboxItems();
        if (inboxItems) {
            setInboxItems(inboxItems);
        }
    };
    const [allChats, setAllChats] = useState<AllChatProps[]>([]);
    const funcSetAllChats = async () => {
        const _allChats: AllChatProps[] = await popAllChats();
        if (_allChats) {
            setAllChats(_allChats);
        }
    };
    const [activityMessages, setActivityMessages] = useState<ActivityMessageProps[]>([]);
    const funcSetActivityMessages = async () => {
        const activityMessages: ActivityMessageProps[] = await popActivityMessages();
        if (activityMessages) {
            setActivityMessages(activityMessages);
        }
    };

    const funcSetTeamMembers = async () => {
        const teamMembers: UserProps[] = await popTeamMembers(myself);
        if (teamMembers) {
            setTeamMembers(teamMembers);
        }
    };

    useEffect(() => {
        funcSetInboxItems();
        funcSetAllChats();
        funcSetActivityMessages();
    }, []);

    useEffect(() => {
        setIsLoading(true);
    }, [myself]);

    useEffect(() => {
        if (isLoading === false) {
            funcSetInboxItems();
            funcSetAllChats();
            funcSetActivityMessages();

            // Load all team users
            funcSetTeamMembers();
        }
    }, [isLoading]);

    useEffect(() => {
        if (accessToken) {
            setSocketInstance(socket(accessToken));
            console.log("WS connected");
        }
    }, [myself, accessToken]);

    wsHook({
        socket: socketInstance,
        accessToken: accessToken,
        myself: myself,
        allChats: allChats,
        currentMainChat: currentMainChat,
        currentSubChat: currentSubChat,
        currentThreadChat: currentThreadChat,
        setCurrentMainChat: setCurrentMainChat,
        setCurrentSubChat: setCurrentSubChat,
        setCurrentThreadChat: setCurrentThreadChat,
        funcSetAllChats: funcSetAllChats,
        setIsTaskCommentUpdated: setIsTaskCommentUpdated,
        isLoading: isLoading,
        funcSetActivityMessages: funcSetActivityMessages,
    });

    return isLoading || currentMainChat === undefined ? (
        <InitialLoad
            myself={myself}
            setIsLoading={setIsLoading}
            setCurrentMainChat={setCurrentMainChat}
        />
    ) : (
        <div className="main-container">
            <CssVarsProvider disableTransitionOnChange>
                <CssBaseline />

                {openingService === 0 ? (
                    <InboxHome
                        myself={myself}
                        socket={socketInstance}
                        setMyself={setMyself}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={setCurrentMainChat}
                        inboxItems={inboxItems}
                    />
                ) : null}

                {openingService === 1 ? (
                    <ChatHome
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        teamMembers={teamMembers}
                        currentChatPaneType={currentChatPaneType}
                        setCurrentChatPaneType={setCurrentChatPaneType}
                        activityMessages={activityMessages}
                        currentMainChat={currentMainChat}
                        setCurrentMainChat={setCurrentMainChat}
                        currentSubChat={currentSubChat}
                        setCurrentSubChat={setCurrentSubChat}
                        currentThreadChat={currentThreadChat}
                        setCurrentThreadChat={setCurrentThreadChat}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        allChats={allChats}
                        setAllChats={setAllChats}
                        funcSetAllChats={funcSetAllChats}
                        isCommentUpdated={isTaskCommentUpdated}
                        setIsCommentUpdated={setIsTaskCommentUpdated}
                    />
                ) : null}

                {openingService === 2 ? (
                    <TaskHome
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        setCurrentMainChat={setCurrentMainChat}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        isCommentUpdated={isTaskCommentUpdated}
                        setIsCommentUpdated={setIsTaskCommentUpdated}
                    />
                ) : null}

                {openingService === 3 ? (
                    <NoteHome
                        socket={socketInstance}
                        myself={myself}
                        setMyself={setMyself}
                        openingService={openingService}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={setCurrentMainChat}
                    />
                ) : null}
            </CssVarsProvider>
        </div>
    );
};
