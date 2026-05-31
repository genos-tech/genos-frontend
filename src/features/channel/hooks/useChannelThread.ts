/**
 * `useChannelThread(channelId, rootMessageId)` — single-thread view.
 *
 * Returns the thread root message + its replies, sorted by tsSent asc,
 * plus a `replyInThread` helper that wraps `channelService.send` with
 * the right `parentId` so the caller doesn't have to thread it through.
 *
 * Live updates flow through the same in-memory store as the main pane.
 * When a `message.created` event arrives for a reply (`isThreadReply
 * === true` with matching `threadRootId`), the store appends it to the
 * channel's message array; this hook filters that array down to the
 * thread's replies.
 *
 * Thread root resolution:
 * - The root message is found by id lookup in the channel's message
 *   list. If the channel only had partial data hydrated, the root may
 *   be missing momentarily — callers see `root === null` until the
 *   broader delta lands.
 * - A thread reply's `threadRootId` always points at the top-level
 *   message; the backend resolves this via `_resolve_thread_root` so
 *   nested replies still link back to the top.
 */

import { useCallback, useMemo, useSyncExternalStore } from "react";

import { channelService, ChannelServiceError } from "../../../services/channel/channelService";
import type { Message } from "../../../types/channel";

export interface UseChannelThreadResult {
    /** The thread's root message, or null if it isn't in the store yet. */
    root: Message | null;
    /** Replies, sorted ascending by tsSent. Empty array until any
     *  reply lands; the root itself is NOT included here. */
    replies: Message[];
    /** Send a reply in this thread. Resolves to the server-confirmed
     *  Message; throws `ChannelServiceError` on failure. */
    replyInThread: (
        body: unknown[],
        opts?: { bodyText?: string; metadata?: Record<string, unknown> }
    ) => Promise<Message | undefined>;
    /** True until the root message lands in the store. Useful for
     *  rendering a "Loading thread…" placeholder. */
    isLoading: boolean;
}

export function useChannelThread(
    channelId: string,
    rootMessageId: string
): UseChannelThreadResult {
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );

    const allMessages = snapshot.messagesByChannel.get(channelId) ?? [];

    const { root, replies } = useMemo(() => {
        let foundRoot: Message | null = null;
        const matchedReplies: Message[] = [];
        for (const m of allMessages) {
            if (m.id === rootMessageId && !m.isThreadReply) foundRoot = m;
            else if (m.isThreadReply && m.threadRootId === rootMessageId) {
                matchedReplies.push(m);
            }
        }
        // Already sorted by tsSent at the store level via `_upsertMessage`.
        return { root: foundRoot, replies: matchedReplies };
    }, [allMessages, rootMessageId]);

    const replyInThread = useCallback(
        async (
            body: unknown[],
            opts: { bodyText?: string; metadata?: Record<string, unknown> } = {}
        ) => {
            try {
                return await channelService.send(channelId, body, {
                    bodyText: opts.bodyText,
                    metadata: opts.metadata,
                    parentId: rootMessageId,
                });
            } catch (e) {
                throw e as ChannelServiceError;
            }
        },
        [channelId, rootMessageId]
    );

    return {
        root,
        replies,
        replyInThread,
        // The thread root may not be in the store on first nav (e.g. a
        // deep link that arrived before the channel's main delta).
        // Once the snapshot is hydrated AND the root is missing, the
        // consumer should fetch the channel detail or fall back to a
        // "thread not loaded" empty state.
        isLoading: !snapshot.hydrated || root === null,
    };
}
