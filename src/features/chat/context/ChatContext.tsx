import { createContext, ReactNode, useContext } from "react";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";

interface ChatContextType {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    useNM: NoteManagementState;
    useTM: TaskManagementState;
}

const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const useChatContext = () => {
    const context = useContext(ChatContext);
    if (!context) {
        throw new Error("useChatContext must be used within a ChatProvider");
    }
    return context;
};

interface ChatProviderProps {
    children: ReactNode;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    usePM: ProjectManagementState;
    useTEM: TeamManagementState;
    useNM: NoteManagementState;
    useTM: TaskManagementState;
}

export const ChatProvider = ({
    children,
    socket,
    myself,
    setMyself,
    useUISM,
    useCM,
    usePM,
    useTEM,
    useNM,
    useTM,
}: ChatProviderProps) => {
    return (
        <ChatContext.Provider
            value={{
                socket,
                myself,
                setMyself,
                useUISM,
                useCM,
                usePM,
                useTEM,
                useNM,
                useTM,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};
