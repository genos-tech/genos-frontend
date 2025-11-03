import { Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { BnChatEditor } from "../../../../components/blockNote/bnChatEditor";
import { BnThreadEditor } from "../../../../components/blockNote/bnThreadEditor";
import { BnUpdateEditor } from "../../../../components/blockNote/bnUpdateEditor";
import { BnUpdateThreadEditor } from "../../../../components/blockNote/bnUpdateThreadEditor";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";

interface ChatEditorSectionProps {
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
    funcSetAllChats?: () => Promise<void>;
    isSubChatVisible?: boolean;
    isThread?: boolean;
    thread?: ThreadProps;
    setCurrentThreadChat?: (chat: ThreadProps) => void;
    setTargetMessageIndex?: (index: number) => void;
}

export const ChatEditorSection = ({
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
    funcSetAllChats,
    isSubChatVisible = false,
    isThread = false,
    thread,
    setCurrentThreadChat,
    setTargetMessageIndex,
}: ChatEditorSectionProps) => {
    if (isThread) {
        return (
            <Box sx={{ paddingLeft: 1, paddingRight: 1 }}>
                {isInEdit === true && editTargetMessage && (
                    <BnUpdateThreadEditor
                        isInEdit={isInEdit}
                        message={editTargetMessage as ThreadMessageProps}
                        myself={myself}
                        numEditorLines={numEditorLines}
                        setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                        setIsInEdit={setIsInEdit}
                        setMyself={setMyself}
                        setNumEditorLines={setNumEditorLines}
                        UIM={UIM}
                        socket={socket}
                        TEM={TEM}
                        thread={thread!}
                    />
                )}
                {isInEdit === false && (
                    <BnThreadEditor
                        myself={myself}
                        numEditorLines={numEditorLines}
                        setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                        setCurrentThreadChat={setCurrentThreadChat!}
                        setMyself={setMyself}
                        setNumEditorLines={setNumEditorLines}
                        UIM={UIM}
                        socket={socket}
                        TEM={TEM}
                        thread={thread!}
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
                    isInEdit={isInEdit}
                    isSubChatVisible={isSubChatVisible}
                    message={editTargetMessage as MessageProps}
                    myself={myself}
                    numEditorLines={numEditorLines}
                    setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                    setIsInEdit={setIsInEdit}
                    setMyself={setMyself}
                    setNumEditorLines={setNumEditorLines}
                    UIM={UIM}
                    socket={socket}
                    TEM={TEM}
                />
            )}
            {isInEdit === false && (
                <BnChatEditor
                    chat={chat as ChatProps}
                    funcSetAllChats={funcSetAllChats!}
                    isSubChatVisible={isSubChatVisible}
                    myself={myself}
                    numEditorLines={numEditorLines}
                    setCurrentChat={setCurrentChat as (chat: ChatProps) => void}
                    setMyself={setMyself}
                    setNumEditorLines={setNumEditorLines}
                    UIM={UIM}
                    socket={socket}
                    TEM={TEM}
                />
            )}
        </Box>
    );
};
