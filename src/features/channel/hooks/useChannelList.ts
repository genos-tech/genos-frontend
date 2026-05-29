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
        // Pinned channels float to the top; within each band (pinned
        // vs not) we keep the recency sort. This matches the legacy
        // sidebar's "pinned first" UX.
        list.sort((a, b) => {
            const aPinned = snapshot.pinByChannelId.has(a.id);
            const bPinned = snapshot.pinByChannelId.has(b.id);
            if (aPinned !== bPinned) return aPinned ? -1 : 1;
            const ta = channelTimeKey(a);
            const tb = channelTimeKey(b);
            return tb.localeCompare(ta); // desc
        });
        const counts: UnreadByKind = { ...ZERO_UNREAD };
        for (const c of list) {
            counts[c.kind] = (counts[c.kind] ?? 0) + c.unreadCount;
        }
        return { channels: list, unreadByKind: counts };
    }, [snapshot.channels, snapshot.pinByChannelId]);

    return {
        channels,
        unreadByKind,
        totalUnread: computeTotalUnread(unreadByKind),
        // "Loading" is the period before `hydrateFromIDB()` has settled
        // (or the bootstrap never ran, e.g. unit tests without a
        // bootstrap mount). Once hydrated, an empty list is a final
        // "no channels" state, not a spinner.
        isLoading: !snapshot.hydrated,
    };
}
