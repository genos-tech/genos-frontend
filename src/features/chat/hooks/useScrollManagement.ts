import { useCallback, useEffect, useRef } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { ChatProps, ThreadProps } from "../../../types/chat";
import { resolveJumpScroll } from "../utils/resolveJumpScroll";

export type VisibleRange = { startIndex: number; endIndex: number };

interface UseScrollManagementProps {
    currentChat: ChatProps | ThreadProps;
    indexMap?: { [k: string]: any };
    isThread?: boolean;
    /** Invoked on every Virtuoso `rangeChanged` tick with the fresh range.
     * Callers hang side effects here (visible-range tracking) instead of
     * watching a state value — see the note on `visibleRangeRef`. */
    onRangeChange?: (range: VisibleRange) => void;
    /** First-unread landing index for this chat, or `null` to land at the
     * bottom. When set, the no-jump "open lands at the bottom" scroll below
     * stands down so the mount paint (`initialTopMostItemIndex`) keeps the
     * pane at the first unread message. Frozen per chat (see
     * `useFirstUnreadIndex`); jump-to-message still works (handled above this
     * gate) and arrival auto-follow is owned by `useScrollToBottomOnChatChange`. */
    firstUnreadIndex?: number | null;
}

export const useScrollManagement = ({
    currentChat,
    indexMap,
    isThread = false,
    onRangeChange,
    firstUnreadIndex,
}: UseScrollManagementProps) => {
    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    // The visible range is tracked in a ref, NOT state. Virtuoso's
    // `rangeChanged` fires continuously while the user scrolls, and a
    // state write here re-rendered the whole pane (header, BlockNote
    // input editor, every visible row wrapper) on every tick — the main
    // source of scroll jank on long chats. Nothing renders the range:
    // auto-follow reads it on demand when its effect fires, and read
    // status is forwarded through `onRangeChange` with its own throttle.
    const visibleRangeRef = useRef<VisibleRange>({ startIndex: 0, endIndex: 0 });
    // Latest-ref so `handleRangeChanged` stays referentially stable even
    // though callers rebuild `onRangeChange` every render.
    const onRangeChangeRef = useRef(onRangeChange);
    onRangeChangeRef.current = onRangeChange;
    const handleRangeChanged = useCallback((range: VisibleRange) => {
        visibleRangeRef.current = range;
        onRangeChangeRef.current?.(range);
    }, []);

    // Coalesce rapid chat / index-map changes into a single delayed scroll.
    // Without this ref, every dep change schedules a fresh 300 ms timer
    // while leaving prior timers pending — and on cleanup-less unmount
    // they'd still fire against a torn-down Virtuoso. Tracking the id in
    // a ref lets us cancel before re-scheduling and on unmount.
    const scrollTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    // The last jump we actually scrolled to. Set only on a real scroll, so
    // a target that hasn't loaded yet is retried on the next `indexMap`
    // update instead of being written off — see `resolveJumpScroll`.
    const lastHandledJumpRef = useRef<string | null>(null);
    useEffect(() => {
        if (scrollTimerRef.current !== null) {
            clearTimeout(scrollTimerRef.current);
        }
        scrollTimerRef.current = setTimeout(() => {
            scrollTimerRef.current = null;
            // Jump identity is per chat AND per thread: the same message id
            // focused in two different threads is two different jumps.
            const chatKey = isThread
                ? `${currentChat.chatId}:${(currentChat as ThreadProps).threadId}`
                : String(currentChat.chatId);
            const targetKey = currentChat.moveToSpecificIndex
                ? `${chatKey}:${currentChat.moveToSpecificIndex}`
                : null;
            const action = resolveJumpScroll({
                lastHandledKey: lastHandledJumpRef.current,
                lastIndex: indexMap ? Object.keys(indexMap).length - 1 : -1,
                resolvedIndex:
                    indexMap && currentChat.moveToSpecificIndex
                        ? indexMap[currentChat.moveToSpecificIndex]
                        : null,
                targetKey,
            });

            if (action.kind === "last") {
                lastHandledJumpRef.current = targetKey;
                virtuosoRef.current?.scrollToIndex({ index: "LAST" });
                return;
            }
            if (action.kind === "index") {
                lastHandledJumpRef.current = targetKey;
                virtuosoRef.current?.scrollToIndex({
                    align: action.align,
                    index: action.index,
                });
                return;
            }
            // No jump to perform. A chat opened WITHOUT a focus target
            // normally lands at the bottom; `notMove` marks the arrived-
            // message / deleted-message updates that must not move the
            // reader (auto-follow for those lives in
            // `useScrollToBottomOnChatChange`). A jump target that simply
            // hasn't resolved yet must NOT fall through to here, or every
            // jump to an unloaded message would slam to the bottom.
            //
            // `firstUnreadIndex != null` also stands down: the chat is opening
            // at its first unread message, painted by Virtuoso's
            // `initialTopMostItemIndex` at mount, and slamming to LAST here
            // would defeat that landing (and, since the cursor is forward-only,
            // mark the whole backlog read — the bug this feature fixes).
            if (
                !currentChat.moveToSpecificIndex &&
                currentChat.notMove !== true &&
                firstUnreadIndex == null
            ) {
                virtuosoRef.current?.scrollToIndex({ index: "LAST" });
            }
        }, 300);
        return () => {
            if (scrollTimerRef.current !== null) {
                clearTimeout(scrollTimerRef.current);
                scrollTimerRef.current = null;
            }
        };
        // The visible range is deliberately not read here: the jump
        // decision is driven by `lastHandledJumpRef`, not by whether the
        // target looks on-screen. See `resolveJumpScroll`.
        // `firstUnreadIndex` is frozen per chat, so it only changes on a chat
        // switch (alongside `currentChat`) — listed for correctness.
    }, [currentChat, indexMap, isThread, firstUnreadIndex]);

    return {
        virtuosoRef,
        visibleRangeRef,
        handleRangeChanged,
    };
};
