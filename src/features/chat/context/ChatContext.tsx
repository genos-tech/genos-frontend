import { createContext, ReactNode, useContext } from "react";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../hooks/common/useProjectManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { NoteManagementState } from "../../../hooks/notes/useNoteManagement";
import { TaskManagementState } from "../../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../../types/admin";

interface ChatContextType {
    socket: Socket | null;
    myself: UserProps;
    setMyself: (me: UserProps) => void;
    openingService: number;
    setOpeningService: (service: number) => void;
    CM: ChatManagementState;
    PM: ProjectManagementState;
    TEM: TeamManagementState;
    NM: NoteManagementState;
    TM: TaskManagementState;
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
    openingService: number;
    setOpeningService: (service: number) => void;
    CM: ChatManagementState;
    PM: ProjectManagementState;
    TEM: TeamManagementState;
    NM: NoteManagementState;
    TM: TaskManagementState;
}

export const ChatProvider = ({
    children,
    socket,
    myself,
    setMyself,
    openingService,
    setOpeningService,
    CM,
    PM,
    TEM,
    NM,
    TM,
}: ChatProviderProps) => {
    return (
        <ChatContext.Provider
            value={{
                socket,
                myself,
                setMyself,
                openingService,
                setOpeningService,
                CM,
                PM,
                TEM,
                NM,
                TM,
            }}
        >
            {children}
        </ChatContext.Provider>
    );
};
