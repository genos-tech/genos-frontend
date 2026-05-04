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

/**
 * Deep-link helper: when `focusedCommentId` is set (from the URL's
 * `comment/:commentId` segment), scroll the Virtuoso list so that
 * comment is visible and centered. The 300 ms delay matches the
 * sibling hook above and gives Virtuoso time to mount its rows after
 * the comment list reloads. No-ops when the id is missing or not in
 * the current `taskComments` slice (deep link aimed at a comment we
 * haven't loaded yet).
 */
export const useScrollToTaskCommentByCommentId = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    taskComments: TaskCommentProps[],
    focusedCommentId: number | undefined
) => {
    useEffect(() => {
        if (focusedCommentId === undefined) return;
        const index = taskComments.findIndex((c) => c.commentId === focusedCommentId);
        if (index === -1) return;
        const timer = setTimeout(() => {
            virtuosoRef.current?.scrollToIndex({
                index,
                align: "center",
                behavior: "smooth",
            });
        }, 300);
        return () => clearTimeout(timer);
        // `taskComments` is included so a deep link that lands before
        // the list has loaded still scrolls once the comments arrive.
    }, [focusedCommentId, taskComments]);
};
