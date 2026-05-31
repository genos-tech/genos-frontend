/**
 * Read-status throttling + advance hook.
 *
 * Forwards "last visible bubble" to the server as the read cursor for
 * the open chat. Replaces the legacy chain
 * (`chatChannel.request("updateReadStatus", ...)` → axios PUT
 * `/api/v2/chat/read/` with integer chat_id) with a single
 * `channelService.markRead(channelUuid, messageUuid)` emit on the
 * `/v3` namespace. The v3 backend:
 *
 *   1. Acks back the updated `ReadCursor`.
 *   2. Broadcasts `read.advanced` to the user's `user:{userId}` room
 *      so OTHER tabs of the same user see the cursor advance.
 *   3. channelService.handleReadAdvanced updates `cursorsByChannel`
 *      in the snapshot, which the chat-list hook reads to recompute
 *      the unread badge.
 *
 * Throttle is unchanged — fast scrolls debounce so we don't flood the
 * socket with one emit per pixel.
 */
import { useRef } from "react";

import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { ChatProps, ThreadProps } from "../../../types/chat";

interface UseReadStatusManagementProps {
    currentChat: ChatProps | ThreadProps;
    myself: UserProps;
    // useCM was used by the legacy path to manually refresh the chat
    // list after the read cursor advanced. With v3 the chat-list hook
    // subscribes to channelService directly, so the refresh fires
    // automatically — keeping the param on the type for back-compat
    // with existing callers.
    useCM: unknown;
    isThread?: boolean;
}

// Throttle windows (ms): how often to forward "last read" upstream during a
// fast scroll. Thread panes update half as often as the main pane.
const MAIN_THROTTLE_MS = 500;
const THREAD_THROTTLE_MS = 1000;

export const useReadStatusManagement = ({
    currentChat,
    isThread = false,
}: UseReadStatusManagementProps) => {
    // Promoted from `useState` to `useRef`: these are throttle bookkeeping
    // that's read by the next scroll handler and never rendered. Keeping
    // them in state caused a re-render after every accepted tick — i.e.
    // every 500 ms while the user scrolls — which cascades through the
    // bubble list. Refs avoid that without affecting throttle behaviour.
    const tsLastReadStatusUpdatedRef = useRef<number>(Date.now());
    const indexLastReadStatusUpdatedRef = useRef<number>(-1);

    const updateReadStatus = (indexForLastReadMessageId: number) => {
        const message = currentChat.messages[indexForLastReadMessageId];
        if (!message) return;
        // v3 markRead takes the v3 message UUID. The legacy → v3
        // adapters store the UUID under different field names by
        // chat kind:
        //   - top-level: `messageIdWithChatId` (`v3MessageToLegacy`)
        //   - thread reply: `messageIdWithChatIdAndThreadId`
        //     (`v3ThreadMessageToLegacy`)
        const messageUuid = isThread
            ? (
                  message as {
                      messageIdWithChatIdAndThreadId?: string;
                  }
              ).messageIdWithChatIdAndThreadId
            : (message as { messageIdWithChatId?: string }).messageIdWithChatId;
        // `chatId` slot carries the v3 channel UUID via the migration
        // cast (`ChatProps.chatId: string`; `ThreadProps.chatId: number`
        // but stringifies idempotently for UUIDs).
        const channelUuidRaw =
            typeof currentChat.chatId === "string"
                ? currentChat.chatId
                : String(currentChat.chatId);
        if (!messageUuid || !channelUuidRaw) {
            console.warn(
                "[useReadStatusManagement] skipped: missing v3 ids " +
                    `(channelUuid=${JSON.stringify(channelUuidRaw)}, ` +
                    `messageUuid=${JSON.stringify(messageUuid)})`
            );
            return;
        }
        // Thread cursor: derive the root UUID from `messages[0]`, which
        // is the parent message after the v3 adapter's prepend.
        const threadRootId = isThread
            ? (
                  (currentChat as ThreadProps).messages?.[0] as
                      | { messageIdWithChatIdAndThreadId?: string }
                      | undefined
              )?.messageIdWithChatIdAndThreadId
            : undefined;
        void channelService
            .markRead(channelUuidRaw, messageUuid, threadRootId)
            .catch((err) => {
                console.error("[useReadStatusManagement] markRead failed", err);
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
