/**
 * Warm the message cache for the handful of chats the user actually
 * ping-pongs between, once, shortly after the sidebar has loaded.
 *
 * Without this, the first open of each chat in a session pays a cold
 * `syncChannel` round-trip with a blank pane (see `channelPrefetch` for
 * the full story). Hover-prefetch covers the deliberate hover→click, but
 * not keyboard navigation, a click that lands faster than the hover
 * delay, or the very first switch after load — this covers those.
 *
 * Deliberately conservative: most-recent N only, concurrency-limited,
 * and scheduled on idle callbacks, because this codebase has a
 * documented history of request storms.
 */

import { useEffect, useRef } from "react";

import { warmRecentChannels } from "../../../services/channel/channelPrefetch";
import { AllChatProps } from "../../../types/chat";

/** Chats to warm at boot. Covers a typical active working set without
 *  turning load into a burst of syncs. */
const WARM_LIMIT = 10;

export function useWarmRecentChannels(allChats: AllChatProps[], enabled = true): void {
    // One warm-up per mount. `allChats` re-derives on every channelService
    // notify (unread counts, pins, live messages), so keying the effect on
    // it directly would re-run the warm-up constantly.
    const hasRunRef = useRef(false);

    useEffect(() => {
        if (!enabled || hasRunRef.current) return;
        if (allChats.length === 0) return;
        hasRunRef.current = true;

        // Most recently active first — that's the set someone switching
        // between DM/GM/PM is most likely to open next. `TSLastMessage`
        // is the same field the sidebar orders on.
        const orderedIds = [...allChats]
            .sort((a, b) => (b.TSLastMessage ?? "").localeCompare(a.TSLastMessage ?? ""))
            .map((c) => c.chatId)
            .filter(Boolean);

        return warmRecentChannels(orderedIds, { limit: WARM_LIMIT });
    }, [allChats, enabled]);
}
