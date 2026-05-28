/**
 * `useChannel(channelId)` — single-channel view hook.
 *
 * Replaces `useMessageManagement` + `useReadStatusManagement` +
 * `useScrollManagement` (which the chat surfaces wire individually
 * today). Subscribes to the `channelService` in-memory store via
 * `useSyncExternalStore`; every socket event that mutates state
 * triggers a re-render automatically.
 *
 * The hook is intentionally read-only on the channel slot: send /
 * edit / delete / react flow through `channelService` mutation
 * methods, which the consumer calls directly. Keeping the hook narrow
 * to "give me the current state of this channel" matches the
 * useSyncExternalStore pattern and avoids the legacy `useChatManagement`
 * God-hook footprint.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { channelService } from "../../../services/channel/channelService";
import type { Channel, Message, ReadCursor } from "../../../types/channel";

export interface UseChannelResult {
    channel: Channel | null;
    /** Non-thread messages (the main pane). Sorted by tsSent asc. */
    messages: Message[];
    /** Thread replies. Use `useChannelThread(messageId)` for a per-thread
     *  view; this is the full list, for callers that already filter. */
    threadReplies: Message[];
    /** Read cursor for the main timeline (thread cursors not exposed
     *  here yet — wiring those once a thread UI consumer needs them). */
    readCursor: ReadCursor | null;
    /**
     * Advance the read cursor to `messageId`. Forward-only — calling
     * with a lower seq than the existing cursor is a server-side no-op.
     * Routes through the socket so other tabs of the same user receive
     * `read.advanced` and decrement their unread badge in real time.
     */
    markRead: (messageId: string) => Promise<void>;
    /** True while there's no channel cached yet. Becomes false the
     *  moment any channel row lands in the store — even if its message
     *  list is still empty. */
    isLoading: boolean;
}

export function useChannel(channelId: string): UseChannelResult {
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );

    const channel = snapshot.channels.get(channelId) ?? null;
    const allMessages = snapshot.messagesByChannel.get(channelId) ?? [];
    const readCursor = snapshot.cursorsByChannel.get(channelId) ?? null;

    // Split top-level vs thread replies. Memoize so consumers that
    // pass these as React.memo props don't re-render every snapshot.
    const { messages, threadReplies } = useMemo(() => {
        const top: Message[] = [];
        const replies: Message[] = [];
        for (const m of allMessages) {
            if (m.isThreadReply) replies.push(m);
            else top.push(m);
        }
        return { messages: top, threadReplies: replies };
    }, [allMessages]);

    const markRead = useCallback(
        async (messageId: string) => {
            await channelService.markRead(channelId, messageId);
        },
        [channelId]
    );

    return {
        channel,
        messages,
        threadReplies,
        readCursor,
        markRead,
        isLoading: channel == null,
    };
}
