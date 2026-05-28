/**
 * `useChannelList()` — chat-list-sidebar hook.
 *
 * Replaces the `allChats` + unread-count logic in `useChatManagement`
 * (lines 124-200ish), including the operator-precedence bug at
 * useChatManagement.ts:372. The new shape uses a typed `Record` +
 * reducer so the bug cannot recur.
 *
 * Subscribes to the `channelService` in-memory store via
 * `useSyncExternalStore`. Every channel.created / message.created /
 * read.advanced event re-renders the list with fresh data.
 */

import { useMemo, useSyncExternalStore } from "react";

import { channelService } from "../../../services/channel/channelService";
import { ChannelKind, type Channel } from "../../../types/channel";

export type UnreadByKind = Record<ChannelKind, number>;

export interface UseChannelListResult {
    /** Sorted by `tsLastMessage` (== `latestMessage.tsSent` if present,
     *  else channel's `tsUpdated`) descending. */
    channels: Channel[];
    /** Per-kind unread sum, with explicit 0 for every kind so callers
     *  don't have to guard for undefined. */
    unreadByKind: UnreadByKind;
    /** Sum across kinds. The legacy `useChatManagement.ts:372` operator-
     *  precedence bug is structurally impossible here — see reducer. */
    totalUnread: number;
    isLoading: boolean;
}

const ZERO_UNREAD: UnreadByKind = {
    [ChannelKind.DM]: 0,
    [ChannelKind.GM]: 0,
    [ChannelKind.PM]: 0,
    [ChannelKind.MDM]: 0,
};

/**
 * Sum a `UnreadByKind` record. Explicit reducer (not a `+`-chain with
 * `||` fallbacks) so missing kinds default to 0 — locks down the
 * `useChatManagement.ts:372` operator-precedence bug forever.
 */
export function computeTotalUnread(byKind: UnreadByKind): number {
    return Object.values(byKind).reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

function channelTimeKey(c: Channel): string {
    return c.latestMessage?.tsSent ?? c.tsUpdated ?? c.tsCreated ?? "";
}

export function useChannelList(): UseChannelListResult {
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );

    const { channels, unreadByKind } = useMemo(() => {
        const list = Array.from(snapshot.channels.values());
        list.sort((a, b) => {
            const ta = channelTimeKey(a);
            const tb = channelTimeKey(b);
            return tb.localeCompare(ta); // desc
        });
        const counts: UnreadByKind = { ...ZERO_UNREAD };
        for (const c of list) {
            counts[c.kind] = (counts[c.kind] ?? 0) + c.unreadCount;
        }
        return { channels: list, unreadByKind: counts };
    }, [snapshot.channels]);

    return {
        channels,
        unreadByKind,
        totalUnread: computeTotalUnread(unreadByKind),
        // We treat the very first snapshot (no channels yet AND no
        // listeners had a chance to populate via hydrate or REST) as
        // "loading". After hydrateFromIDB() runs, even an empty list
        // is a final state — so the consumer should call hydrate before
        // mount, and the first non-default snapshot will mark loading
        // done.
        isLoading: snapshot.channels.size === 0,
    };
}
