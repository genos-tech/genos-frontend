import { Tooltip, Box, IconButton } from "@mui/joy";
import FlagIcon from "@mui/icons-material/Flag";
import { updateFlagMessage } from "../../services/updateFlagMessage";
import { UserProps } from "../../../../types/admin";
import { useState } from "react";
import { addMessage } from "../../services/addMessage";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";

type BubbleFlagButtonTypes = {
    accessToken: string | null;
    myself: UserProps;
    currentChat?: ChatProps;
    setCurrentChat?: (chat: ChatProps) => void;
    currentThreadChat?: ThreadProps;
    setCurrentThreadChat?: (chat: ThreadProps) => void;
    threadId: number;
    message: MessageProps | ThreadMessageProps;
};
export const BubbleFlagButton = (props: BubbleFlagButtonTypes) => {
    const {
        accessToken,
        myself,
        currentChat,
        setCurrentChat,
        currentThreadChat,
        setCurrentThreadChat,
        threadId,
        message,
    } = props;
    const [tmpIsFlagged, setTmpIsFlagged] = useState(message.isFlagged || false);
    return (
        <Box sx={{ textAlign: "right" }}>
            <>
                <Tooltip title={tmpIsFlagged ? "Unflag" : "Flag"} size="sm">
                    <IconButton
                        size="sm"
                        color={tmpIsFlagged ? "danger" : "neutral"}
                        onClick={() => {
                            // If the message is not a thread message,
                            // we need to update the message in the indexedDB.
                            if (threadId === 0 && currentChat && setCurrentChat) {
                                setCurrentChat({
                                    ...currentChat,
                                    messages: currentChat.messages.map((m) => ({
                                        ...m,
                                        isFlagged:
                                            m.messageId === message.messageId
                                                ? !m.isFlagged
                                                : m.isFlagged,
                                    })),
                                });
                                addMessage(
                                    { ...message, isFlagged: !tmpIsFlagged } as MessageProps,
                                    currentChat.chatType
                                );
                                updateFlagMessage(accessToken, myself, {
                                    chat_type: currentChat.chatType,
                                    chat_id: currentChat.chatId,
                                    thread_id: threadId,
                                    message_id: message.messageId,
                                });
                            } else if (currentThreadChat && setCurrentThreadChat) {
                                setCurrentThreadChat({
                                    ...currentThreadChat,
                                    messages: currentThreadChat.messages.map((m) => ({
                                        ...m,
                                        isFlagged:
                                            m.messageId === message.messageId
                                                ? !m.isFlagged
                                                : m.isFlagged,
                                    })),
                                });
                                updateFlagMessage(accessToken, myself, {
                                    chat_type: currentThreadChat.chatType,
                                    chat_id: currentThreadChat.chatId,
                                    thread_id: threadId,
                                    message_id: message.messageId,
                                });
                            }

                            setTmpIsFlagged(!tmpIsFlagged);
                        }}
                    >
                        <FlagIcon />
                    </IconButton>
                </Tooltip>
            </>
        </Box>
    );
};
