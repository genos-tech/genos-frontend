import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnChatEditor } from "../../../../components/blockNote/bnChatEditor";
import { BnThreadEditor } from "../../../../components/blockNote/bnThreadEditor";
import { BnUpdateEditor } from "../../../../components/blockNote/bnUpdateEditor";
import { BnUpdateThreadEditor } from "../../../../components/blockNote/bnUpdateThreadEditor";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";

interface ChatEditorSectionProps {
    CM: ChatManagementState;
    isInEdit: boolean;
    editTargetMessage?: MessageProps | ThreadMessageProps;
    chat: ChatProps | ThreadProps;
    myself: UserProps;
    numEditorLines: number;
    setCurrentChat: (chat: ChatProps | ThreadProps) => void;
    setIsInEdit: (edit: boolean) => void;
    setMyself: (user: UserProps) => void;
    setNumEditorLines: (lines: number) => void;
    UIM: UIStateManagementState;
    socket: Socket | null;
    TEM: TeamManagementState;
    isThread?: boolean;
    thread?: ThreadProps;
    setCurrentThreadChat?: (chat: ThreadProps) => void;
}

export const ChatEditorSection = ({
    CM,
    isInEdit,
    editTargetMessage,
    chat,
    myself,
    numEditorLines,
    setCurrentChat,
    setIsInEdit,
    setMyself,
    setNumEditorLines,
    UIM,
    socket,
    TEM,
    isThread = false,
    thread,
    setCurrentThreadChat,
}: ChatEditorSectionProps) => {
    if (isThread) {
        return (
            <Box sx={{ paddingLeft: 1, paddingRight: 1 }}>
                {isInEdit === true && editTargetMessage && (
                    <BnUpdateThreadEditor
                        CM={CM}
                        isInEdit={isInEdit}
                        message={editTargetMessage as ThreadMessageProps}
                        myself={myself}
                        numEditorLines={numEditorLines}
                        setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                        setIsInEdit={setIsInEdit}
                        setMyself={setMyself}
                        setNumEditorLines={setNumEditorLines}
                        socket={socket}
                        TEM={TEM}
                        thread={thread!}
                        UIM={UIM}
                    />
                )}
                {isInEdit === false && (
                    <BnThreadEditor
                        CM={CM}
                        myself={myself}
                        numEditorLines={numEditorLines}
                        setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                        setCurrentThreadChat={setCurrentThreadChat!}
                        setMyself={setMyself}
                        setNumEditorLines={setNumEditorLines}
                        socket={socket}
                        TEM={TEM}
                        thread={thread!}
                        UIM={UIM}
                    />
                )}
            </Box>
        );
    }

    return (
        <Box sx={{ paddingLeft: 1, paddingRight: 1 }}>
            {isInEdit === true && editTargetMessage && (
                <BnUpdateEditor
                    chat={chat as ChatProps}
                    CM={CM}
                    isInEdit={isInEdit}
                    message={editTargetMessage as MessageProps}
                    myself={myself}
                    numEditorLines={numEditorLines}
                    setIsInEdit={setIsInEdit}
                    setMyself={setMyself}
                    setNumEditorLines={setNumEditorLines}
                    socket={socket}
                    TEM={TEM}
                    UIM={UIM}
                />
            )}
            {isInEdit === false && (
                <BnChatEditor
                    chat={chat as ChatProps}
                    CM={CM}
                    myself={myself}
                    numEditorLines={numEditorLines}
                    setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                    setMyself={setMyself}
                    setNumEditorLines={setNumEditorLines}
                    socket={socket}
                    TEM={TEM}
                    UIM={UIM}
                />
            )}
        </Box>
    );
};
