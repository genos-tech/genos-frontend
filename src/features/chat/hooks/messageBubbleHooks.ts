import { useEffect, useRef } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { ActivityMessageProps, AllChatProps } from "../../../types/chat";

export const useScrollToBottomOnNewMessage = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    chat: any,
    targetIndex: number
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        if (virtuoso === null) {
            return;
        } else {
            setTimeout(() => {
                virtuoso.scrollToIndex({
                    index: targetIndex,
                    behavior: "smooth",
                });
            }, 200); // wait 200ms
        }
    }, [chat]);
};

/**
 * Auto-follow: keep a pane pinned to the newest message.
 *
 * Scrolls to LAST when the chat changes or a message arrives, EXCEPT when
 * `notMove` marks an arrived/deleted-message update and the reader has
 * scrolled away from the bottom (`visibleRangeEnd < maxIndex - 3`) — then
 * they stay where they are.
 *
 * Jumping to a specific message is NOT this hook's job; `useScrollManagement`
 * owns that. The two used to race, both firing `scrollToIndex` on a 300ms
 * timer against the same Virtuoso.
 *
 * The visible range arrives as a REF (see `useScrollManagement`): range
 * ticks don't re-render anything anymore, so a plain number param would
 * be frozen at whatever the last real render saw. Reading the ref when
 * the effect fires always sees the live scroll position.
 *
 * `firstUnreadIndex`: when a chat opens at its first unread message (not the
 * bottom — see `useFirstUnreadIndex`), the OPEN fire must stand down or it
 * would immediately drag the pane to LAST and defeat the landing. Only the
 * first fire per chat is suppressed; later fires (message arrivals, which
 * re-run this effect via `indexMap`) keep normal auto-follow, so a reply of
 * yours still pulls the pane down. Tracked with a per-chat "have I fired for
 * this chat yet" ref rather than gating on `firstUnreadIndex` directly, since
 * that value is frozen for the chat's whole life and would disable follow
 * permanently.
 */
export const useScrollToBottomOnChatChange = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    currentMainChatId: number,
    visibleRangeRef: React.RefObject<{ startIndex: number; endIndex: number }>,
    maxIndex: number,
    indexMap?: { [k: string]: any },
    moveToSpecificIndex?: string,
    notMove?: boolean,
    firstUnreadIndex?: number | null
) => {
    // Which chat we've already had our first effect-fire for. Reset when the
    // chat id changes so the next chat's open fire is recognised as its first.
    const openedForChatRef = useRef<number | null>(null);
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        const visibleRangeEnd = visibleRangeRef.current?.endIndex ?? 0;
        // Don't consume the "first fire" flag until the chat actually has rows.
        // A cold channel (not yet in IDB) fires this effect once while its sync
        // is still in flight: messages empty, Virtuoso not mounted, and — the
        // crux — `firstUnreadIndex` not yet knowable (it freezes only once
        // messages arrive, see `useFirstUnreadIndex`). If we marked the chat
        // "opened" on that empty fire, the REAL first paint (messages arrive,
        // `firstUnreadIndex` now frozen) would be seen as a later fire, skip the
        // stand-down, and slam to LAST — defeating the first-unread landing for
        // every channel not already cached. Bail before touching the flag so the
        // first fire that counts is the first one with a message to land on.
        // (`maxIndex` is `messages.length - 1`; empty ⇒ -1. Nothing to scroll to
        // anyway, so this early-return is safe on the pre-first-unread path too.)
        if (maxIndex < 0) {
            return;
        }
        const isFirstFireForChat = openedForChatRef.current !== currentMainChatId;
        openedForChatRef.current = currentMainChatId;
        // Opening at the first unread message: let the mount paint
        // (`initialTopMostItemIndex`) own the landing and don't scroll to LAST.
        // Only the OPEN fire stands down — subsequent arrivals fall through to
        // normal auto-follow below.
        if (isFirstFireForChat && firstUnreadIndex != null) {
            return;
        }
        // `notMove === true && visibleRangeEnd < maxIndex - 3`: Even if `notMove===true`,
        // scrolling to the LAST when an user is around in the last/latest message.
        if (virtuoso === null || (notMove === true && visibleRangeEnd < maxIndex - 3)) {
            return;
        }
        // Auto-follow only. Jumping to a specific message is owned by
        // `useScrollManagement`, which is the single authority for it —
        // it tracks which jump it has already performed and retries
        // targets that aren't in the loaded slice yet. This hook used to
        // race it with its own `scrollToIndex`, guarded by a stale
        // visible range that skipped targets near the bottom.
        //
        // Bailing here (rather than falling through) is load-bearing: the
        // scroll-to-LAST below would otherwise drag every jump straight to
        // the bottom of the chat.
        if (moveToSpecificIndex) {
            return;
        }
        setTimeout(() => {
            virtuoso.scrollToIndex({
                behavior: "auto",
                index: "LAST",
            });
        }, 300); // wait 300ms
    }, [currentMainChatId, indexMap]);
};

export const useScrollToBottomOnNewActivity = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    activityMessages: ActivityMessageProps[],
    notMove: boolean
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        if (virtuoso === null || notMove === true) {
            return;
        } else {
            setTimeout(() => {
                virtuoso.scrollToIndex({
                    index: 0,
                    behavior: "auto",
                });
            }, 300); // wait 300ms
        }
    }, [activityMessages]);
};
