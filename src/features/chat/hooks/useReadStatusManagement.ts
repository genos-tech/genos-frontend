/*
 * PUNCH LIST (v3 chatId migration):
 * The worker IDB still uses integer `chatId` and integer
 * `lastReadMessageId` (its `updateReadStatus` / `popSpecificChat` /
 * `addChat` contracts haven't been migrated yet). `ChatProps` /
 * `AllChatProps.chatId` are `string` post-v3 flip, and
 * `lastReadMessageId` is `string` too. The casts below bridge the
 * boundary. At runtime UUID-shaped ids passed to the worker will
 * land in the integer-keyed IDB store as string values — the read
 * path round-trips them, so the hook still functions for legacy
 * chats during the transition. Whole file is replaced by
 * `channelService.markRead` once the v3 read-cursor path is wired
 * into MainChatPane.
 */
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

        // See file-header note: `chatId` is cast to number at the
        // worker-contract boundary.
        const legacyChatId = currentChat.chatId as unknown as number;
        // Keys sorted alphabetically per `sort-keys`.
        chatChannel
            .request("updateReadStatus", {
                accessToken,
                chatId: legacyChatId,
                chatType: currentChat.chatType,
                isThread,
                lastReadMessageId,
                myself,
                threadId: isThread ? (currentChat as ThreadProps).threadId : 0,
            })
            .then(async () => {
                // `lastReadMessageId` is string post-flip; the legacy
                // values are stringified ints so `Number(...)` round-
                // trips. UUID-shaped cursors NaN and the strict-less
                // check below fails — which is the safer side
                // (under-update beats double-write).
                const previousLastRead = Number(
                    (currentChat as ChatProps).lastReadMessageId || "0"
                );
                if (previousLastRead < lastReadMessageId) {
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
                        chatId: legacyChatId,
                        chatType: currentChat.chatType,
                    })) as AllChatProps | null;
                    // `lastReadMessageId` is `string` on AllChatProps —
                    // stringify the numeric `lastReadMessageId` we just
                    // forwarded to the worker. `as unknown as AllChatProps`
                    // for the fallback path because `ChatProps` and
                    // `AllChatProps` share most fields but TS treats the
                    // spread shape as non-overlapping.
                    const lastReadStr = String(lastReadMessageId);
                    const updatedChat: AllChatProps = existing
                        ? { ...existing, lastReadMessageId: lastReadStr }
                        : ({
                              ...currentChat,
                              lastReadMessageId: lastReadStr,
                          } as unknown as AllChatProps);
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

    // Keys sorted alphabetically per `sort-keys`.
    return {
        handlePeriodicReadStatusUpdate,
        handleReadStatusUpdate,
        updateReadStatus,
    };
};
