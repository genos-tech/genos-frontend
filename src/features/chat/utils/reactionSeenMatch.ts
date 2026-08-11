import type { ActivityMessageProps } from "../../../types/chat";

// Reaction sidebar activities can't be cleared by the read cursor: the
// cursor is forward-only + seq-monotonic, but a reaction to an OLD message
// mints a NEW activity pointing back at that old (low-seq) bubble the cursor
// has already swept past (see the backend `_SEQ_CLEARABLE_ACTIVITY_TYPES`
// comment — REACTION is deliberately excluded there). The only truthful
// signal for "this reaction was seen" is the reacted-to bubble actually
// entering the viewport. These pure helpers turn that per-bubble "seen"
// signal into the set of reaction activities to mark read.
//
// The mapping is purely LOCAL: a reaction activity stores the reacted-to
// message's v3 UUID in `messageUniqueKey` (and, for a thread-reply reaction,
// identically in `threadMessageUniqueKey`) — `v3ActivityToLegacy` sets both
// to `msg.id`. A rendered bubble carries that same UUID as its
// `messageIdWithChatId` / `messageIdWithChatIdAndThreadId` key. So a seen
// bubble matches its reaction activities by direct string equality, no
// server lookup.
export const REACTION_ACTIVITY_TYPE = 2;

/**
 * Index the activity store as `messageUUID → [unread reaction activityId]`.
 *
 * Only UNREAD reaction rows are indexed — already-read ones need no
 * clearing, and skipping them keeps the "seen" fast-path from ever
 * scheduling a redundant clear. A message can carry several reaction
 * activities (different reactors), so each key maps to an array. Both
 * `messageUniqueKey` and `threadMessageUniqueKey` are indexed; they hold the
 * same UUID for a thread-reply reaction, but indexing both is robust to
 * either field being the one populated.
 */
export function buildReactionSeenIndex(
    activityMessages: ActivityMessageProps[]
): Map<string, string[]> {
    const index = new Map<string, string[]>();
    for (const a of activityMessages) {
        if (a.activityType !== REACTION_ACTIVITY_TYPE || a.isRead !== false) continue;
        const keys = new Set<string>();
        if (a.messageUniqueKey) keys.add(a.messageUniqueKey);
        if (a.threadMessageUniqueKey) keys.add(a.threadMessageUniqueKey);
        for (const key of keys) {
            const bucket = index.get(key);
            if (bucket) bucket.push(a.activityId);
            else index.set(key, [a.activityId]);
        }
    }
    return index;
}

/**
 * Resolve activityIds back to their current still-unread rows, ready to hand
 * to `markFilteredAsRead`. Re-checks `isRead` against the LATEST store
 * snapshot so a row already cleared between the "seen" event and the
 * debounced flush (e.g. by a sidebar click, or the cross-tab bridge) is
 * dropped rather than re-sent.
 */
export function clearableRowsForIds(
    activityIds: Iterable<string>,
    activityMessages: ActivityMessageProps[]
): ActivityMessageProps[] {
    const wanted = new Set(activityIds);
    return activityMessages.filter((a) => wanted.has(a.activityId) && a.isRead === false);
}
