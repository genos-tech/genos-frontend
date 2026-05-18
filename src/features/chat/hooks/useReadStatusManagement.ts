import { useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { chatChannel } from "../../../db/workers/channels";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, ThreadProps } from "../../../types/chat";
import { addChat } from "../services/addChat";

interface UseReadStatusManagementProps {
    currentChat: ChatProps | ThreadProps;
    myself: UserProps;
    useCM: ChatManagementState;
    isThread?: boolean;
}

export const useReadStatusManagement = ({
    useCM,
    currentChat,
    myself,
    isThread = false,
}: UseReadStatusManagementProps) => {
    const { accessToken } = useAuth();
    const [tsLastReadStatusUpdated, setTsLastReadStatusUpdated] = useState<number>(Date.now());
    const [indexLastReadStatusUpdated, setIndexLastReadStatusUpdated] = useState<number>(-1);

    const updateReadStatus = (indexForLastReadMessageId: number) => {
        if (!accessToken || !currentChat.messages[indexForLastReadMessageId]) {
            return;
        }
        const lastReadMessageId: number =
            currentChat.messages[indexForLastReadMessageId].messageId;

        chatChannel
            .request("updateReadStatus", {
                accessToken,
                myself,
                chatType: currentChat.chatType,
                chatId: currentChat.chatId,
                isThread,
                threadId: isThread ? (currentChat as ThreadProps).threadId : 0,
                lastReadMessageId,
            })
            .then(async () => {
                if ((currentChat as ChatProps).lastReadMessageId < lastReadMessageId) {
                    const updatedChat = {
                        ...currentChat,
                        lastReadMessageId,
                    };
                    await addChat(updatedChat as AllChatProps, updatedChat.chatType);
                    await useCM.funcSetAllChats();
                }
            })
            .catch((err) => {
                console.error("Failed to update read status", err);
            });
    };

    const handleReadStatusUpdate = (targetIndex: number) => {
        if (targetIndex !== -1) {
            updateReadStatus(targetIndex);
            setIndexLastReadStatusUpdated(targetIndex);
            const now = Date.now();
            setTsLastReadStatusUpdated(now);
        }
    };

    const handlePeriodicReadStatusUpdate = (visibleRangeEnd: number) => {
        const intervalMs: number = isThread ? 1000 : 500;
        const now = Date.now();
        if (
            now - tsLastReadStatusUpdated >= intervalMs &&
            visibleRangeEnd > indexLastReadStatusUpdated
        ) {
            updateReadStatus(visibleRangeEnd);
            setTsLastReadStatusUpdated(now);
            setIndexLastReadStatusUpdated(visibleRangeEnd);
        }
    };

    return {
        updateReadStatus,
        handleReadStatusUpdate,
        handlePeriodicReadStatusUpdate,
        tsLastReadStatusUpdated,
        indexLastReadStatusUpdated,
    };
};
