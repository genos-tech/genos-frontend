import FlagIcon from "@mui/icons-material/Flag";
import { Box, IconButton, Tooltip } from "@mui/joy";
import { useEffect, useState } from "react";

import { FlaggedService } from "../../../../db/services/flagged.service";
import { UserProps } from "../../../../types/admin";
import {
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../types/chat";
import { addFlaggedMessage } from "../../services/addFlaggedMessage";
import { addMessage } from "../../services/addMessage";
import { updateFlagMessage } from "../../services/updateFlagMessage";
import { getFirstLine } from "../../utils/common";

type BubbleFlagButtonTypes = {
    accessToken: string | null;
    myself: UserProps;
    currentChat?: ChatProps;
    setCurrentChat?: (chat: ChatProps) => void;
    currentThreadChat?: ThreadProps;
    setCurrentThreadChat?: (chat: ThreadProps) => void;
    threadId: number;
    message: MessageProps | ThreadMessageProps;
    flaggedMessages: FlaggedMessageProps[];
    setFlaggedMessages: (messages: FlaggedMessageProps[]) => void;
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
        flaggedMessages,
        setFlaggedMessages,
    } = props;
    const [tmpIsFlagged, setTmpIsFlagged] = useState(message.isFlagged || false);

    useEffect(() => {
        setTmpIsFlagged(message.isFlagged || false);
    }, [message]);

    return (
        <Box sx={{ textAlign: "right" }}>
            <Tooltip size="sm" title={tmpIsFlagged ? "Unflag" : "Flag"} variant="outlined">
                <IconButton
                    color={tmpIsFlagged ? "danger" : "neutral"}
                    size="sm"
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

                            // Add the flagged message to the indexedDB
                            if (tmpIsFlagged === false) {
                                addFlaggedMessage({
                                    flaggedMessageId: `${currentChat.chatType}-${
                                        currentChat.chatId
                                    }-${0}-${message.messageId}`,
                                    chatType: currentChat.chatType,
                                    chatId: currentChat.chatId,
                                    threadId: 0,
                                    messageId: message.messageId,
                                    contentText: getFirstLine(message.content[0]),
                                    sender: message.sender,
                                    dmPartnerUser: currentChat.dmPartnerUser,
                                    project: currentChat.project,
                                    taskId: 0,
                                    tsSent: message.tsSent,
                                } as FlaggedMessageProps);

                                setFlaggedMessages([
                                    ...flaggedMessages,
                                    {
                                        flaggedMessageId: `${currentChat.chatType}-${
                                            currentChat.chatId
                                        }-${0}-${message.messageId}`,
                                        chatType: currentChat.chatType,
                                        chatName: currentChat.chatName,
                                        chatId: currentChat.chatId,
                                        threadId: 0,
                                        messageId: message.messageId,
                                        contentText: getFirstLine(message.content[0]),
                                        sender: message.sender,
                                        dmPartnerUser: currentChat.dmPartnerUser,
                                        project: currentChat.project,
                                        taskId: 0,
                                        tsSent: message.tsSent,
                                    },
                                ]);
                            } else {
                                // Delete the flagged message from the indexedDB
                                const flaggedService = new FlaggedService();
                                flaggedService.deleteFlaggedMessage(
                                    `${currentChat.chatType}-${currentChat.chatId}-${0}-${
                                        message.messageId
                                    }`
                                );

                                // Delete the unflagged message from the flaggedMessages array
                                setFlaggedMessages(
                                    flaggedMessages.filter(
                                        (_message) =>
                                            _message.flaggedMessageId !==
                                            `${currentChat.chatType}-${currentChat.chatId}-${0}-${
                                                message.messageId
                                            }`
                                    )
                                );
                            }

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

                            // Add the flagged message to the indexedDB
                            if (tmpIsFlagged === false) {
                                addFlaggedMessage({
                                    flaggedMessageId: `${currentThreadChat.chatType}-${currentThreadChat.chatId}-${threadId}-${message.messageId}`,
                                    chatType: currentThreadChat.chatType,
                                    chatId: currentThreadChat.chatId,
                                    threadId: threadId,
                                    messageId: message.messageId,
                                    contentText: getFirstLine(message.content[0]),
                                    sender: message.sender,
                                    dmPartnerUser: currentThreadChat.dmPartnerUser,
                                    project: currentThreadChat.project,
                                    taskId: currentThreadChat.taskId || 0,
                                    tsSent: message.tsSent,
                                } as FlaggedMessageProps);

                                setFlaggedMessages([
                                    ...flaggedMessages,
                                    {
                                        flaggedMessageId: `${currentThreadChat.chatType}-${currentThreadChat.chatId}-${threadId}-${message.messageId}`,
                                        chatName: currentThreadChat.chatName,
                                        chatType: currentThreadChat.chatType,
                                        chatId: currentThreadChat.chatId,
                                        threadId: threadId,
                                        messageId: message.messageId,
                                        contentText: getFirstLine(message.content[0]),
                                        sender: message.sender,
                                        dmPartnerUser: currentThreadChat.dmPartnerUser,
                                        project: currentThreadChat.project,
                                        taskId: currentThreadChat.taskId || 0,
                                        tsSent: message.tsSent,
                                    },
                                ]);
                            } else {
                                // Delete the flagged message from the indexedDB
                                const flaggedService = new FlaggedService();
                                flaggedService.deleteFlaggedMessage(
                                    `${currentThreadChat.chatType}-${currentThreadChat.chatId}-${threadId}-${message.messageId}`
                                );

                                setFlaggedMessages(
                                    flaggedMessages.filter(
                                        (_message) =>
                                            _message.flaggedMessageId !==
                                            `${currentThreadChat.chatType}-${currentThreadChat.chatId}-${threadId}-${message.messageId}`
                                    )
                                );
                            }
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
        </Box>
    );
};
