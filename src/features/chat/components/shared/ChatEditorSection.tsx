import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnChatEditor } from "../../../../components/editors/bnChatEditor";
import { BnThreadEditor } from "../../../../components/editors/bnThreadEditor";
import { BnUpdateEditor } from "../../../../components/editors/bnUpdateEditor";
import { BnUpdateThreadEditor } from "../../../../components/editors/bnUpdateThreadEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";

interface ChatEditorSectionProps {
    useCM: ChatManagementState;
    isInEdit: boolean;
    editTargetMessage?: MessageProps | ThreadMessageProps;
    chat: ChatProps | ThreadProps;
    myself: UserProps;
    numEditorLines: number;
    setCurrentChat: (chat: ChatProps | ThreadProps) => void;
    setIsInEdit: (edit: boolean) => void;
    setMyself: (user: UserProps) => void;
    setNumEditorLines: (lines: number) => void;
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    isThread?: boolean;
    thread?: ThreadProps;
    setCurrentThreadChat?: (chat: ThreadProps) => void;
    pendingFiles?: File[];
    clearPendingFiles?: () => void;
}

export const ChatEditorSection = ({
    useCM,
    isInEdit,
    editTargetMessage,
    chat,
    myself,
    numEditorLines,
    setCurrentChat,
    setIsInEdit,
    setMyself,
    setNumEditorLines,
    useUISM,
    socket,
    useTEM,
    isThread = false,
    thread,
    setCurrentThreadChat,
    pendingFiles,
    clearPendingFiles,
}: ChatEditorSectionProps) => {
    if (isThread) {
        return (
            <Box sx={{ paddingLeft: 1, paddingRight: 1, paddingBottom: 1 }}>
                {isInEdit === true && editTargetMessage && (
                    <BnUpdateThreadEditor
                        useCM={useCM}
                        isInEdit={isInEdit}
                        message={editTargetMessage as ThreadMessageProps}
                        myself={myself}
                        numEditorLines={numEditorLines}
                        setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                        setIsInEdit={setIsInEdit}
                        setMyself={setMyself}
                        setNumEditorLines={setNumEditorLines}
                        socket={socket}
                        useTEM={useTEM}
                        thread={thread!}
                        useUISM={useUISM}
                    />
                )}
                {isInEdit === false && (
                    <BnThreadEditor
                        useCM={useCM}
                        myself={myself}
                        numEditorLines={numEditorLines}
                        setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                        setCurrentThreadChat={setCurrentThreadChat!}
                        setMyself={setMyself}
                        setNumEditorLines={setNumEditorLines}
                        socket={socket}
                        useTEM={useTEM}
                        thread={thread!}
                        useUISM={useUISM}
                        pendingFiles={pendingFiles}
                        clearPendingFiles={clearPendingFiles}
                    />
                )}
            </Box>
        );
    }

    return (
        <Box sx={{ paddingLeft: 1, paddingRight: 1, paddingBottom: 1 }}>
            {isInEdit === true && editTargetMessage && (
                <BnUpdateEditor
                    chat={chat as ChatProps}
                    useCM={useCM}
                    isInEdit={isInEdit}
                    message={editTargetMessage as MessageProps}
                    myself={myself}
                    numEditorLines={numEditorLines}
                    setIsInEdit={setIsInEdit}
                    setMyself={setMyself}
                    setNumEditorLines={setNumEditorLines}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            )}
            {isInEdit === false && (
                <BnChatEditor
                    chat={chat as ChatProps}
                    useCM={useCM}
                    myself={myself}
                    numEditorLines={numEditorLines}
                    setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                    setMyself={setMyself}
                    setNumEditorLines={setNumEditorLines}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
                    pendingFiles={pendingFiles}
                    clearPendingFiles={clearPendingFiles}
                />
            )}
        </Box>
    );
};
