/**
 * Read-status advance hook.
 *
 * Forwards the newest SEEN bubble to the server as the read cursor for the
 * open chat. Replaces the legacy chain
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
 * ADVANCE-BY-SEEN, NOT BY-RANGE. The cursor used to be driven by Virtuoso's
 * `rangeChanged.endIndex`, but that range spans the RENDERED rows — including
 * the ~600px `increaseViewportBy` overscan below the fold — so it marked a
 * dozen never-seen messages read. Opening a chat then landing at the first
 * unread message (see `useFirstUnreadIndex`) would immediately mark the
 * overscan below it read: the very bug this feature exists to kill, just
 * smaller. Now `handleSeenIndex` is fed by the per-bubble IntersectionObserver
 * in `useReactionSeenClear` (rooted on the scroller, overscan excluded), so
 * only bubbles that actually crossed the viewport advance the cursor.
 *
 * THROTTLE (trailing, to the max). The observer fires discrete "row seen"
 * events, not a continuous stream, so a plain leading-throttle would keep the
 * first index of a burst and DROP the higher ones (they never re-fire once
 * entered) — the cursor would stick below the visible screenful until the next
 * scroll. Instead we track the maximum seen index and flush THAT on the
 * trailing edge of the window (one `markRead` per burst, mirroring the
 * `useReactionSeenClear` flush precedent: 500ms main / 1000ms thread).
 */
import { useEffect, useRef } from "react";

import { channelService } from "../../../services/channel/channelService";
import { UserProps } from "../../../types/admin";
import { ChatProps, ThreadProps } from "../../../types/chat";
import { isV3Uuid } from "../../../utils/legacyId";

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
    // Throttle bookkeeping, kept in refs (never rendered): a state write here
    // re-rendered after every accepted tick — every 500 ms while scrolling —
    // cascading through the bubble list. Refs keep it off the hot path.
    //
    // `indexLastReadStatusUpdatedRef` is the forward-only high-water mark: the
    // highest index the cursor has been advanced to. Seen events at or below
    // it are ignored (the cursor can't go backwards).
    const indexLastReadStatusUpdatedRef = useRef<number>(-1);
    // Highest index seen but not yet flushed, and the trailing-flush timer.
    const pendingMaxIndexRef = useRef<number>(-1);
    const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Reset the forward-only high-water mark when the chat changes. This hook
    // instance is NOT remounted per chat (the pane persists across switches),
    // so without this the mark leaks: after reading to index 80 in chat A,
    // opening chat B would ignore every seen event ≤ 80 and never advance B's
    // cursor until the reader scrolled past index 80. The removed
    // mark-to-latest-on-open effects used to reset it as a side effect; this
    // makes the reset explicit. Done in render (ref compare) so it lands
    // before the observer's first async "seen" callback for the new chat.
    const lastChatKeyRef = useRef<string | null>(null);
    const chatKey =
        isThread && (currentChat as ThreadProps).threadId != null
            ? `${currentChat.chatId}:${(currentChat as ThreadProps).threadId}`
            : String(currentChat.chatId);
    if (lastChatKeyRef.current !== chatKey) {
        lastChatKeyRef.current = chatKey;
        indexLastReadStatusUpdatedRef.current = -1;
        pendingMaxIndexRef.current = -1;
        if (flushTimerRef.current != null) {
            clearTimeout(flushTimerRef.current);
            flushTimerRef.current = null;
        }
    }

    // v3 markRead takes the v3 message UUID. The legacy → v3 adapters
    // store the UUID under different field names by chat kind:
    //   - top-level: `messageIdWithChatId` (`v3MessageToLegacy`)
    //   - thread reply: `messageIdWithChatIdAndThreadId`
    //     (`v3ThreadMessageToLegacy`)
    const messageUuidAt = (index: number): string | undefined => {
        const message = currentChat.messages[index];
        if (!message) return undefined;
        return isThread
            ? (message as { messageIdWithChatIdAndThreadId?: string })
                  .messageIdWithChatIdAndThreadId
            : (message as { messageIdWithChatId?: string }).messageIdWithChatId;
    };

    const updateReadStatus = (indexForLastReadMessageId: number) => {
        // A message we've sent but the server hasn't acked is rendered
        // from its optimistic echo, whose id slot holds the client's
        // `corr-<random>` correlation id. That's the bubble at the tail
        // right after you hit send — i.e. precisely what the callers
        // below hand us — and it isn't a cursor the backend can resolve.
        // Walk back to the newest bubble that has a real UUID so the
        // cursor still advances instead of stalling until the next tick.
        let messageUuid: string | undefined;
        const startIndex = Math.min(indexForLastReadMessageId, currentChat.messages.length - 1);
        for (let i = startIndex; i >= 0; i--) {
            const candidate = messageUuidAt(i);
            if (candidate && isV3Uuid(candidate)) {
                messageUuid = candidate;
                break;
            }
        }
        // `chatId` slot carries the v3 channel UUID via the migration
        // cast (`ChatProps.chatId: string`; `ThreadProps.chatId: number`
        // but stringifies idempotently for UUIDs).
        const channelUuidRaw =
            typeof currentChat.chatId === "string"
                ? currentChat.chatId
                : String(currentChat.chatId);
        if (!messageUuid || !channelUuidRaw) {
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
        // markRead is fully best-effort and never rejects now (see
        // channelService.markRead) — a failed cursor advance self-heals on
        // the next scroll / chat re-open and is not worth surfacing. The
        // `.catch` is defensive only and intentionally silent; logging here
        // flooded the console once the backend started timing out, since
        // this fires on every scroll tick.
        void channelService.markRead(channelUuidRaw, messageUuid, threadRootId).catch(() => {});
    };

    const flushSeen = () => {
        flushTimerRef.current = null;
        const idx = pendingMaxIndexRef.current;
        pendingMaxIndexRef.current = -1;
        // Re-check against the high-water mark in case it advanced between the
        // last seen event and this flush (it can't regress, so this only
        // guards a no-op).
        if (idx > indexLastReadStatusUpdatedRef.current) {
            updateReadStatus(idx);
            indexLastReadStatusUpdatedRef.current = idx;
        }
    };

    // Called by the per-bubble seen-observer for each row that crosses the
    // viewport. Records the highest index seen and flushes it on the trailing
    // edge of the throttle window. Forward-only: an index at or below the
    // high-water mark (scrolling back up over already-read messages) is
    // ignored, so the cursor never regresses.
    const handleSeenIndex = (index: number) => {
        if (index <= indexLastReadStatusUpdatedRef.current) return;
        if (index > pendingMaxIndexRef.current) pendingMaxIndexRef.current = index;
        if (flushTimerRef.current == null) {
            const intervalMs = isThread ? THREAD_THROTTLE_MS : MAIN_THROTTLE_MS;
            flushTimerRef.current = setTimeout(flushSeen, intervalMs);
        }
    };

    // Drop any armed flush on unmount so it can't fire against a torn-down
    // pane (mirrors the same guard in `useReactionSeenClear`).
    useEffect(() => {
        return () => {
            if (flushTimerRef.current != null) {
                clearTimeout(flushTimerRef.current);
                flushTimerRef.current = null;
            }
        };
    }, []);

    // Keys sorted alphabetically per `sort-keys`.
    return {
        handleSeenIndex,
        updateReadStatus,
    };
};
