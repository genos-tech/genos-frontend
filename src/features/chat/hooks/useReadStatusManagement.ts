import { useState } from "react";

import { useAuth } from "../../../context/AuthContext";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps, ChatProps, ThreadProps } from "../../../types/chat";
import UpdateReadStatusWorker from "../../../workers/updateReadStatusWorker.ts?worker";
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
        if (accessToken && currentChat.messages[indexForLastReadMessageId]) {
            const updateReadStatusWorker = new UpdateReadStatusWorker();
            const lastReadMessageId: number =
                currentChat.messages[indexForLastReadMessageId].messageId;

            updateReadStatusWorker.postMessage({
                accessToken: accessToken,
                myself: myself,
                chatType: currentChat.chatType,
                chatId: currentChat.chatId,
                isThread: isThread,
                threadId: isThread ? (currentChat as ThreadProps).threadId : 0,
                lastReadMessageId: lastReadMessageId,
            });

            updateReadStatusWorker.onmessage = async (event) => {
                if (event.data === "done") {
                    if ((currentChat as ChatProps).lastReadMessageId < lastReadMessageId) {
                        const updatedChat = {
                            ...currentChat,
                            lastReadMessageId: lastReadMessageId,
                        };
                        addChat(updatedChat as AllChatProps, updatedChat.chatType);
                        await useCM.funcSetAllChats();
                    }
                } else {
                    console.error("Failed to update read status");
                }
            };

            return () => {
                updateReadStatusWorker.terminate();
            };
        }
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
