import { useRef } from "react";

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

// Throttle windows (ms): how often to forward "last read" upstream during a
// fast scroll. Thread panes update half as often as the main pane.
const MAIN_THROTTLE_MS = 500;
const THREAD_THROTTLE_MS = 1000;

export const useReadStatusManagement = ({
    useCM,
    currentChat,
    myself,
    isThread = false,
}: UseReadStatusManagementProps) => {
    const { accessToken } = useAuth();
    // Promoted from `useState` to `useRef`: these are throttle bookkeeping
    // that's read by the next scroll handler and never rendered. Keeping
    // them in state caused a re-render after every accepted tick — i.e.
    // every 500 ms while the user scrolls — which cascades through the
    // bubble list. Refs avoid that without affecting throttle behaviour.
    const tsLastReadStatusUpdatedRef = useRef<number>(Date.now());
    const indexLastReadStatusUpdatedRef = useRef<number>(-1);

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
                    // Merge into the persisted row rather than spreading
                    // `currentChat` (which is `ChatProps` and does not
                    // carry `mdmMembers`, `profileImagePath`,
                    // `tsLastAllReadActivity`, etc.). Spreading the
                    // narrower type would silently clobber those fields
                    // in IDB — the subsequent `funcSetAllChats()` then
                    // surfaces the corrupted row to the UI, which for
                    // MDM chats is observable as the avatar reverting
                    // to the generic People icon.
                    const existing = (await chatChannel.request("popSpecificChat", {
                        chatId: currentChat.chatId,
                        chatType: currentChat.chatType,
                    })) as AllChatProps | null;
                    const updatedChat: AllChatProps = existing
                        ? { ...existing, lastReadMessageId }
                        : ({ ...currentChat, lastReadMessageId } as AllChatProps);
                    await addChat(updatedChat, updatedChat.chatType);
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
            indexLastReadStatusUpdatedRef.current = targetIndex;
            tsLastReadStatusUpdatedRef.current = Date.now();
        }
    };

    const handlePeriodicReadStatusUpdate = (visibleRangeEnd: number) => {
        const intervalMs = isThread ? THREAD_THROTTLE_MS : MAIN_THROTTLE_MS;
        const now = Date.now();
        if (
            now - tsLastReadStatusUpdatedRef.current >= intervalMs &&
            visibleRangeEnd > indexLastReadStatusUpdatedRef.current
        ) {
            updateReadStatus(visibleRangeEnd);
            tsLastReadStatusUpdatedRef.current = now;
            indexLastReadStatusUpdatedRef.current = visibleRangeEnd;
        }
    };

    return {
        updateReadStatus,
        handleReadStatusUpdate,
        handlePeriodicReadStatusUpdate,
    };
};
