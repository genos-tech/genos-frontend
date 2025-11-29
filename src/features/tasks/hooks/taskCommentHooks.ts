import { useEffect } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { TaskCommentProps } from "../../../types/tasks";

export const useScrollToBottomOnNewTaskComment = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    taskComments: TaskCommentProps[],
    scrollToBottom: boolean
) => {
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        if (virtuoso === null || scrollToBottom === false) {
            return;
        } else {
            setTimeout(() => {
                virtuoso.scrollToIndex({
                    index: "LAST",
                    behavior: "auto",
                });
            }, 300); // wait 300ms
        }
    }, [taskComments]);
};
