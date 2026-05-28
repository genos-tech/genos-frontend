/**
 * `useChannelList()` — chat-list-sidebar hook.
 *
 * Replaces the `allChats` + unread-count logic in `useChatManagement`
 * (lines 124-200ish), including the operator-precedence bug at
 * useChatManagement.ts:372 — the new shape uses a typed `Record` +
 * reducer so the bug cannot recur.
 *
 * Returns the sorted channel list, per-kind unread counts, and a
 * total unread sum. The chat-list sidebar renders directly off this.
 *
 * Phase 4 scope: surface + stub return. Live query plumbing arrives
 * with the rest of the v3 IDB write paths.
 */

import { useState } from "react";

import type { Channel, ChannelKind } from "../../../types/channel";

export type UnreadByKind = Record<ChannelKind, number>;

export interface UseChannelListResult {
    channels: Channel[];
    unreadByKind: UnreadByKind;
    totalUnread: number;
    /**
     * True while the initial IDB read or the first delta fetch is
     * in flight.
     */
    isLoading: boolean;
}

/**
 * Sum a `UnreadByKind` record. Explicit reducer (not `+`-chain with
 * `||` fallbacks) so missing kinds default to 0 — locks down the
 * `useChatManagement.ts:372` operator-precedence bug forever.
 */
export function computeTotalUnread(byKind: UnreadByKind): number {
    return Object.values(byKind).reduce<number>((acc, n) => acc + (n ?? 0), 0);
}

export function useChannelList(): UseChannelListResult {
    // TODO: live query against IDB CHANNELS store, sorted by
    // tsLastMessage desc. Unread counts come from each channel's
    // denormalized `unreadCount` field (server-computed) — see
    // ChannelSerializer in unified_serializers.py.
    const [channels] = useState<Channel[]>([]);
    const [unreadByKind] = useState<UnreadByKind>({
        1: 0,
        2: 0,
        3: 0,
        4: 0,
    } as UnreadByKind);
    const [isLoading] = useState<boolean>(true);

    return {
        channels,
        unreadByKind,
        totalUnread: computeTotalUnread(unreadByKind),
        isLoading,
    };
}
