import { useCallback, useRef } from "react";

// Set on the board while a card is held; the columns' card lists stop
// scrolling for the length of it (see the note in SprintBoardColumn).
export const BOARD_DRAGGING_ATTR = "data-sprint-board-dragging";

// The columns scroll themselves, except while a card is held. Toggled on
// the DOM node, not in React state: dnd measures the scroll parent right
// after `onBeforeCapture` returns, and a state update would land after
// that.
export const useBoardDragScrollLock = () => {
    const boardRef = useRef<HTMLDivElement>(null);
    const lockColumnScroll = useCallback(() => {
        boardRef.current?.setAttribute(BOARD_DRAGGING_ATTR, "true");
    }, []);
    const unlockColumnScroll = useCallback(() => {
        boardRef.current?.removeAttribute(BOARD_DRAGGING_ATTR);
    }, []);
    return { boardRef, lockColumnScroll, unlockColumnScroll };
};
