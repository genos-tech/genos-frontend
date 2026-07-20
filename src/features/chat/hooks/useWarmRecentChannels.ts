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
    // `allChats` is re-derived into a NEW array on every channelService
    // notify — including the ones caused by this warm-up's own syncs
    // landing. So it must NOT be an effect dependency: React would run
    // the previous effect's cleanup on each churn, and that cleanup is
    // the queue's canceller, killing the warm-up after its first batch.
    // Read it through a ref instead, and key the effect on booleans that
    // only change when there's a genuine reason to start or stop.
    const chatsRef = useRef(allChats);
    useEffect(() => {
        chatsRef.current = allChats;
    }, [allChats]);

    // Flips false -> true once, when the sidebar first has chats. Declared
    // after the ref-sync effect above so that effect has already run by
    // the time this one fires on the same commit.
    const hasChats = allChats.length > 0;

    useEffect(() => {
        if (!enabled || !hasChats) return;

        // Most recently active first — that's the set someone switching
        // between DM/GM/PM is most likely to open next. `TSLastMessage`
        // is the same field the sidebar orders on.
        const orderedIds = [...chatsRef.current]
            .sort((a, b) => (b.TSLastMessage ?? "").localeCompare(a.TSLastMessage ?? ""))
            .map((c) => c.chatId)
            .filter(Boolean);

        // Cleanup now only runs on unmount (or sign-out emptying the
        // list), which is exactly when abandoning the queue is right.
        return warmRecentChannels(orderedIds, { limit: WARM_LIMIT });
    }, [enabled, hasChats]);
}
