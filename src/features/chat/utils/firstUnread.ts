/**
 * Where a chat pane should land when it opens: the FIRST unread message,
 * not the bottom.
 *
 * WHY THIS EXISTS: opening a chat used to shove the read cursor to the
 * latest message (see the removed mark-to-latest effects in the panes),
 * so opening a channel with 100 unread marked all 100 read. The cursor is
 * forward-only by `seq`, so landing at the BOTTOM (the highest seq) would
 * jump the cursor to the max even with a precise advance — the landing
 * position is load-bearing, not cosmetic. Landing at the first unread and
 * only advancing the cursor as bubbles are actually seen (the observer in
 * `useReactionSeenClear`) is what keeps unseen messages unread.
 *
 * Pure on purpose: the surrounding hook deals with the channelService
 * snapshot and freezing per chat; every off-by-one rule that's easy to get
 * wrong lives here and is unit-tested.
 *
 * The cursor is identified by the v3 message UUID it points at
 * (`ReadCursor.lastReadMessageId`). We resolve it against the SAME rendered
 * `messages` array the list paints, keying on the per-row v3 UUID
 * (`messageIdWithChatId`, or `messageIdWithChatIdAndThreadId` in a thread)
 * — the exact key `indexMap` and the jump-to-message path already use. The
 * returned index is therefore a valid index into that array.
 */

// The row shape we read: both id variants are optional because a legacy row
// can arrive without a v3 UUID (it then can't match a cursor and is skipped).
interface FirstUnreadRow {
    messageIdWithChatId?: string;
    messageIdWithChatIdAndThreadId?: string;
}

/**
 * Resolve the index the pane should open at, or `null` to mean "land at the
 * bottom" (Virtuoso's existing default).
 *
 * `null` (land at bottom) is returned for every case where opening at a
 * first-unread would be wrong or unknown:
 *   - No cursor (`null`/empty): the channel was NEVER read — per product,
 *     a never-read channel opens at the latest message, not the top.
 *   - Cursor points at a message NOT in the loaded slice: it aged out of
 *     the retention window (rare, since the chat loads without pagination).
 *     We can't place first-unread reliably, so fall back to the bottom.
 *   - Cursor points at the LAST message: everything is already read.
 */
export function resolveFirstUnreadIndex(
    messages: readonly FirstUnreadRow[],
    cursorMessageId: string | null | undefined,
    isThread: boolean
): number | null {
    if (!cursorMessageId) return null;

    const keyOf = (m: FirstUnreadRow): string | undefined =>
        isThread ? m.messageIdWithChatIdAndThreadId : m.messageIdWithChatId;

    let cursorIndex = -1;
    for (let i = 0; i < messages.length; i++) {
        if (keyOf(messages[i]) === cursorMessageId) {
            cursorIndex = i;
            break;
        }
    }
    // Cursor message isn't in the loaded slice → can't locate first-unread.
    if (cursorIndex === -1) return null;

    const firstUnread = cursorIndex + 1;
    // Cursor is at (or past) the last message → nothing unread → bottom.
    if (firstUnread > messages.length - 1) return null;
    return firstUnread;
}
