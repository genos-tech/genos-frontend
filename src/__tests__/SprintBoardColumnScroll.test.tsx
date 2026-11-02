import { DragDropContext } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { COLUMNS } from "../features/tasks/components/board/SprintBoard";
import { SprintBoardColumn } from "../features/tasks/components/board/SprintBoardColumn";
import {
    BOARD_DRAGGING_ATTR,
    useBoardDragScrollLock,
} from "../features/tasks/components/board/useBoardDragScrollLock";
import { UserProps } from "../types/admin";

// MIP-900. Each column scrolls its own cards, but dnd allows a Droppable one
// scroll parent, so the board switches the columns' scrolling off for the
// length of a drag. jsdom has no layout, so this pins the two halves of that
// contract; the real behaviour (sideways auto-scroll, drops into a scrolled
// column) was checked in headless Chrome.
describe("column scroll lock while dragging", () => {
    it("toggles the board attribute and tolerates an unmounted board", () => {
        const { result } = renderHook(() => useBoardDragScrollLock());
        // No board mounted yet: must not throw (onBeforeCapture can't be
        // allowed to break a drag).
        expect(() => result.current.lockColumnScroll()).not.toThrow();

        const board = document.createElement("div");
        (result.current.boardRef as { current: HTMLDivElement | null }).current = board;
        act(() => result.current.lockColumnScroll());
        expect(board.getAttribute(BOARD_DRAGGING_ATTR)).toBe("true");
        act(() => result.current.unlockColumnScroll());
        expect(board.hasAttribute(BOARD_DRAGGING_ATTR)).toBe(false);
    });

    it("a column's card list scrolls, except while the board is marked as dragging", () => {
        const { container } = render(
            <CssVarsProvider>
                <DragDropContext onDragEnd={() => {}}>
                    <div id="board">
                        <SprintBoardColumn
                            column={COLUMNS[0]}
                            myself={{} as UserProps}
                            tasks={[]}
                            teamMemberProfiles={{}}
                        />
                    </div>
                </DragDropContext>
            </CssVarsProvider>
        );
        const board = container.querySelector("#board") as HTMLElement;
        const droppable = container.querySelector("[data-rfd-droppable-id]") as HTMLElement;
        expect(droppable).toBeTruthy();

        expect(getComputedStyle(droppable).overflowY).toBe("auto");
        board.setAttribute(BOARD_DRAGGING_ATTR, "true");
        expect(getComputedStyle(droppable).overflowY).toBe("hidden");
        board.removeAttribute(BOARD_DRAGGING_ATTR);
        expect(getComputedStyle(droppable).overflowY).toBe("auto");
    });
});
