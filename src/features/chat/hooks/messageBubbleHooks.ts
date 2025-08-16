import { useEffect } from "react";
import { VirtuosoHandle } from "react-virtuoso";

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

export const useScrollToBottomOnChatChange = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    currentMainChatId: number,
    indexMap?: { [k: string]: any },
    moveToSpecificIndex?: string
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        if (virtuoso === null) {
            return;
        } else {
            setTimeout(() => {
                if (indexMap && moveToSpecificIndex) {
                    virtuoso.scrollToIndex({
                        index: indexMap[moveToSpecificIndex],
                    });
                } else {
                    virtuoso.scrollToIndex({
                        index: "LAST",
                        behavior: "auto",
                    });
                }
            }, 300); // wait 300ms
        }
    }, [currentMainChatId, indexMap]);
};
