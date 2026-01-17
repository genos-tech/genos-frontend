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

    useEffect(() => {
        setTimeout(() => {
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
    }, [currentChat, indexMap]);

    return {
        virtuosoRef,
        visibleRange,
        setVisibleRange,
        isScrolling,
        setIsScrolling,
    };
};
