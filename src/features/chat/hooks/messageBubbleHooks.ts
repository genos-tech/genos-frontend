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
    visibleRangeStart: number,
    visibleRangeEnd: number,
    maxIndex: number,
    indexMap?: { [k: string]: any },
    moveToSpecificIndex?: string,
    notMove?: boolean,
    setErrorMessage?: (value: string) => void,
    setErrorOpen?: (value: boolean) => void
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        // `notMove === true && visibleRangeEnd < maxIndex - 3`: Even if `notMove===true`,
        // scrolling to the LAST when an user is around in the last/latest message.
        if (virtuoso === null || (notMove === true && visibleRangeEnd < maxIndex - 3)) {
            return;
        } else {
            setTimeout(() => {
                if (indexMap && moveToSpecificIndex) {
                    if (indexMap[moveToSpecificIndex]) {
                        const targetIndex = indexMap[moveToSpecificIndex];
                        // Only scroll if the target is not already visible
                        console.log(targetIndex, visibleRangeStart, visibleRangeEnd)
                        if (targetIndex < visibleRangeStart || targetIndex > visibleRangeEnd) {
                            virtuoso.scrollToIndex({
                                index: targetIndex,
                            });
                        }
                    } else if (
                        indexMap.length > 0 &&
                        Object.keys(indexMap)[0][0] !== moveToSpecificIndex[0]
                    ) {
                        if (setErrorMessage && setErrorOpen) {
                            setErrorMessage("The message has been deleted.");
                            setErrorOpen(true);
                        }
                    } else {
                        console.warn("moveToSpecificIndex not found in indexMap");
                        // console.warn("indexMap:", indexMap);
                        // console.warn("moveToSpecificIndex:", moveToSpecificIndex);
                    }
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
