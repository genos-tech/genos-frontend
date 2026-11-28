import { useEffect, useRef } from "react";
import { VirtuosoHandle } from "react-virtuoso";

import { TaskCommentProps } from "../../../types/tasks";
import { smoothScrollBehavior } from "../../../utils/motion";

export const useScrollToBottomOnNewTaskComment = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    taskComments: TaskCommentProps[],
    scrollToBottom: boolean
) => {
    // Read at effect time: the effect is keyed on the comment list alone, so a
    // flag flip must not re-run it (and scroll) by itself.
    const scrollToBottomRef = useRef(scrollToBottom);
    scrollToBottomRef.current = scrollToBottom;
    useEffect(() => {
        const virtuoso = virtuosoRef.current;
        if (virtuoso === null || scrollToBottomRef.current === false) {
            return;
        } else {
            setTimeout(() => {
                virtuoso.scrollToIndex({
                    index: "LAST",
                    behavior: "auto",
                });
            }, 300); // wait 300ms
        }
    }, [taskComments, virtuosoRef]);
};

/**
 * Deep-link helper: when `focusedCommentId` is set (from the URL's
 * `comment/:commentId` segment), scroll the Virtuoso list so that
 * comment is visible and centered. The 300 ms delay matches the
 * sibling hook above and gives Virtuoso time to mount its rows after
 * the comment list reloads. No-ops when the id is missing or not in
 * the current `taskComments` slice (deep link aimed at a comment we
 * haven't loaded yet). Scrolls once per id: a new comment, a reaction or
 * an edit must not pull a reader back to the linked one (MIP-2543).
 */
export const useScrollToTaskCommentByCommentId = (
    virtuosoRef: React.RefObject<VirtuosoHandle>,
    taskComments: TaskCommentProps[],
    focusedCommentId: number | undefined
) => {
    const scrolledToRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (focusedCommentId === undefined) {
            scrolledToRef.current = undefined;
            return;
        }
        if (scrolledToRef.current === focusedCommentId) return;
        const index = taskComments.findIndex((c) => c.commentId === focusedCommentId);
        if (index === -1) return;
        const timer = setTimeout(() => {
            scrolledToRef.current = focusedCommentId;
            virtuosoRef.current?.scrollToIndex({
                index,
                align: "center",
                behavior: smoothScrollBehavior(),
            });
        }, 300);
        return () => clearTimeout(timer);
        // `taskComments` is included so a deep link that lands before
        // the list has loaded still scrolls once the comments arrive.
    }, [focusedCommentId, taskComments, virtuosoRef]);
};

/** Time for the list to have scrolled itself to the comment (the hook above) and drawn its row. */
const REVEAL_DELAY_MS = 900;

/**
 * Bring the focused comment into view of every scroller AROUND the list, up to the dialog. The list
 * hook above only scrolls the list itself, which in a preview modal can sit below the fold
 * (MIP-1755). Not `scrollIntoView`: that also scrolls `overflow: hidden` boxes and would shift the
 * dialog. Once per id, like the list scroll.
 */
export const useRevealFocusedComment = (
    scrollerRef: React.RefObject<HTMLElement | null>,
    taskComments: TaskCommentProps[],
    focusedCommentId: number | undefined
) => {
    const revealedRef = useRef<number | undefined>(undefined);
    useEffect(() => {
        if (focusedCommentId === undefined || revealedRef.current === focusedCommentId) return;
        if (!taskComments.some((c) => c.commentId === focusedCommentId)) return;
        const timer = setTimeout(() => {
            const scroller = scrollerRef.current;
            const row = scroller?.querySelector<HTMLElement>("[data-comment-focused]");
            if (!scroller || !row) return;
            revealedRef.current = focusedCommentId;
            for (
                let box = scroller.parentElement;
                box && box.getAttribute("role") !== "dialog";
                box = box.parentElement
            ) {
                const { overflowY } = getComputedStyle(box);
                if (!/auto|scroll/.test(overflowY) || box.scrollHeight <= box.clientHeight)
                    continue;
                const rowBox = row.getBoundingClientRect();
                const view = box.getBoundingClientRect();
                // A row taller than the view shows its top; a shorter one sits in the middle.
                const space = Math.max(0, (view.height - rowBox.height) / 2);
                box.scrollBy({
                    top: rowBox.top - view.top - space,
                    behavior: smoothScrollBehavior(),
                });
            }
        }, REVEAL_DELAY_MS);
        return () => clearTimeout(timer);
    }, [focusedCommentId, taskComments, scrollerRef]);
};
