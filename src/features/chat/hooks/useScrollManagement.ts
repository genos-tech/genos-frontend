import { useEffect, useRef, useState } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { ChatProps, ThreadProps } from "../../../types/chat";
import { resolveJumpScroll } from "../utils/resolveJumpScroll";

interface UseScrollManagementProps {
    currentChat: ChatProps | ThreadProps;
    indexMap?: { [k: string]: any };
    isThread?: boolean;
}

export const useScrollManagement = ({
    currentChat,
    indexMap,
    isThread = false,
}: UseScrollManagementProps) => {
    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    const [visibleRange, setVisibleRange] = useState({
        startIndex: 0,
        endIndex: 0,
    });
    const [isScrolling, setIsScrolling] = useState(false);

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
            // still lands at the bottom; `notMove` marks the arrived-
            // message / deleted-message updates that must not move the
            // reader (auto-follow for those lives in
            // `useScrollToBottomOnChatChange`). A jump target that simply
            // hasn't resolved yet must NOT fall through to here, or every
            // jump to an unloaded message would slam to the bottom.
            if (!currentChat.moveToSpecificIndex && currentChat.notMove !== true) {
                virtuosoRef.current?.scrollToIndex({ index: "LAST" });
            }
        }, 300);
        return () => {
            if (scrollTimerRef.current !== null) {
                clearTimeout(scrollTimerRef.current);
                scrollTimerRef.current = null;
            }
        };
        // `visibleRange` is deliberately not a dep (and no longer read):
        // the jump decision is driven by `lastHandledJumpRef`, not by
        // whether the target looks on-screen. See `resolveJumpScroll`.
    }, [currentChat, indexMap, isThread]);

    return {
        virtuosoRef,
        visibleRange,
        setVisibleRange,
        isScrolling,
        setIsScrolling,
    };
};
