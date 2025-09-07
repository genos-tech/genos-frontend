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

export const useScrollToBottomOnChatChange = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    currentMainChatId: number,
    indexMap?: { [k: string]: any },
    moveToSpecificIndex?: string,
    notMove?: boolean
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        if (virtuoso === null || notMove === true) {
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

export const useScrollToBottomOnChatPaneChange = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    allChats: AllChatProps[]
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        if (virtuoso === null) {
            return;
        } else {
            setTimeout(() => {
                virtuoso.scrollToIndex({
                    index: 0,
                    behavior: "auto",
                });
            }, 300); // wait 300ms
        }
    }, [allChats]);
};

export const useScrollToBottomOnNewActivity = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    activityMessages: ActivityMessageProps[]
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        if (virtuoso === null) {
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
