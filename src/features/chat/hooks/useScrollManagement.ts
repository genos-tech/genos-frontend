import { useEffect, useRef, useState } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { ChatProps, ThreadProps } from "../../../types/chat";

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
    useEffect(() => {
        if (scrollTimerRef.current !== null) {
            clearTimeout(scrollTimerRef.current);
        }
        scrollTimerRef.current = setTimeout(() => {
            scrollTimerRef.current = null;
            if (indexMap && currentChat.moveToSpecificIndex) {
                const targetIndex = indexMap[currentChat.moveToSpecificIndex];
                // Only scroll if the target is not already visible
                if (targetIndex < visibleRange.startIndex || targetIndex > visibleRange.endIndex) {
                    virtuosoRef.current?.scrollToIndex({
                        index: targetIndex,
                    });
                }
            } else if (currentChat.notMove !== true) {
                virtuosoRef.current?.scrollToIndex({
                    index: "LAST",
                });
            }
        }, 300);
        return () => {
            if (scrollTimerRef.current !== null) {
                clearTimeout(scrollTimerRef.current);
                scrollTimerRef.current = null;
            }
        };
    }, [currentChat, indexMap]);

    return {
        virtuosoRef,
        visibleRange,
        setVisibleRange,
        isScrolling,
        setIsScrolling,
    };
};
