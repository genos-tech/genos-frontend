import type { RefObject } from "react";

import { columnMove, useRovingNav, type RovingConfig } from "../../../../hooks/common/roving";
import { BOARD_DRAGGING_ATTR } from "./useBoardDragScrollLock";

// The board's keyboard model (MIP-1402): one Tab stop per column, the active card of the
// column. Up / Down move inside the column, Left / Right to the neighbouring column that has
// cards (at the same index, or its last card), Home / End to the first / last card of the
// column, Ctrl+Home / End to the first / last of the board. Enter opens the preview (the
// card's own `Clickable`), Space lifts the card (the drag library); while a card is lifted
// the library owns every key, and the `data-sprint-board-dragging` flag, which is set for a
// keyboard lift too, keeps this silent. A card's own buttons (the task id, the graph) stay in
// the Tab order for the ACTIVE card only, so nothing is unreachable.
const BOARD_NAV: RovingConfig = {
    move: columnMove,
    groupOrder: "dom",
    keepInner: true,
    paused: (board) => board.hasAttribute(BOARD_DRAGGING_ATTR),
};

/** The ref callback for the board element; also fills `boardRef` (the drag scroll lock's). */
export const useBoardRovingNav = (boardRef: RefObject<HTMLDivElement | null>) =>
    useRovingNav(BOARD_NAV, boardRef).ref;
