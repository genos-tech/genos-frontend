import { useEffect } from "react";
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
 */
export const useScrollToBottomOnChatChange = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    currentMainChatId: number,
    visibleRangeRef: React.RefObject<{ startIndex: number; endIndex: number }>,
    maxIndex: number,
    indexMap?: { [k: string]: any },
    moveToSpecificIndex?: string,
    notMove?: boolean
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        const visibleRangeEnd = visibleRangeRef.current?.endIndex ?? 0;
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
