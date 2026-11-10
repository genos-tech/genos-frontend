import { useRef } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { COLUMNS } from "../features/tasks/components/board/SprintBoard";
import { SprintBoardColumn } from "../features/tasks/components/board/SprintBoardColumn";
import { BOARD_DRAGGING_ATTR } from "../features/tasks/components/board/useBoardDragScrollLock";
import { useBoardRovingNav } from "../features/tasks/components/board/useBoardRovingNav";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

// MIP-1402: the REAL board column and card with the board's roving hook. jsdom has no layout
// and no drag library keyboard sensor; the lift, the drop and the focus ring were walked in a
// browser (genos-docs design/evidence/MIP-1402.md). This pins the markup contract and the keys.

const myself = { userId: "u1", teamId: "t1" } as unknown as UserProps;
const task = (id: number, status: string, title = `Card ${id}`): TaskTableProps =>
    ({
        id: String(id),
        displayId: `PRJ-${id}`,
        title,
        status,
        parentTaskId: null,
        rootTaskId: null,
        projectId: 1,
        tags: [],
        isMilestone: false,
        milestoneId: null,
    }) as unknown as TaskTableProps;

const BY_ID = Object.fromEntries(COLUMNS.map((c) => [c.id, c]));

const Board = ({
    cards,
    onTaskClick,
}: {
    cards: Record<string, TaskTableProps[]>;
    onTaskClick?: (t: TaskTableProps) => void;
}) => {
    const boardRef = useRef<HTMLDivElement>(null);
    const ref = useBoardRovingNav(boardRef);
    return (
        <CssVarsProvider>
            <DragDropContext onDragEnd={() => {}}>
                <div ref={ref} data-testid="board">
                    {Object.entries(cards).map(([col, tasks]) => (
                        <SprintBoardColumn
                            key={col}
                            column={BY_ID[col]}
                            myself={myself}
                            tasks={tasks}
                            teamMemberProfiles={{}}
                            onOpenDiagram={() => {}}
                            onTaskClick={onTaskClick}
                        />
                    ))}
                </div>
            </DragDropContext>
        </CssVarsProvider>
    );
};

const handles = (container: HTMLElement) =>
    Array.from(container.querySelectorAll<HTMLElement>("[data-rfd-drag-handle-draggable-id]"));
const tabbable = (container: HTMLElement) =>
    Array.from(
        container.querySelectorAll<HTMLElement>("[tabindex], button:not([disabled])")
    ).filter((el) => el.tabIndex >= 0);

const setup = (onTaskClick?: (t: TaskTableProps) => void) => {
    const view = render(
        <Board
            cards={{
                open: [task(1, "Open"), task(2, "Open"), task(3, "Open")],
                wip: [task(4, "WIP")],
                blocked: [],
                closed: [task(5, "Closed"), task(6, "Closed")],
            }}
            onTaskClick={onTaskClick}
        />
    );
    return { ...view, board: view.getByTestId("board") };
};

describe("the board's roving tab stops", () => {
    it("is one Tab stop per column (the active card and its own buttons), not one per card and button", async () => {
        const { board } = setup();
        await waitFor(() =>
            expect(handles(board).filter((h) => h.tabIndex === 0)).toHaveLength(3)
        );
        // 3 columns with cards: the active card of each, plus its task id chip and graph button.
        const stops = tabbable(board).map((el) =>
            el.closest("[data-roving-item]")?.getAttribute("data-roving-item")
        );
        expect(new Set(stops)).toEqual(new Set(["1", "4", "5"]));
        // 6 cards x (card + id chip + graph button) would be 18 before.
        expect(tabbable(board).length).toBeLessThanOrEqual(9);
        for (const h of handles(board).filter(
            (x) => !["1", "4", "5"].includes(x.dataset.rfdDragHandleDraggableId!)
        )) {
            expect(h.tabIndex).toBe(-1);
        }
    });

    it("each card is declared to the nav with its column and its task id", () => {
        const { board } = setup();
        const card = board.querySelector('[data-rfd-drag-handle-draggable-id="5"]')!;
        expect(card.getAttribute("data-roving-group")).toBe("closed");
        expect(card.getAttribute("data-roving-item")).toBe("5");
    });

    it("names each column for a screen reader", () => {
        setup();
        expect(screen.getByRole("group", { name: "Open" })).toBeTruthy();
        expect(screen.getByRole("group", { name: "Closed" })).toBeTruthy();
    });

    it("arrows move between cards and columns, an empty column is skipped", () => {
        const { board } = setup();
        const card = (id: string) =>
            board.querySelector<HTMLElement>(`[data-rfd-drag-handle-draggable-id="${id}"]`)!;
        card("1").focus();
        fireEvent.keyDown(card("1"), { key: "ArrowDown" });
        expect(document.activeElement).toBe(card("2"));
        fireEvent.keyDown(card("2"), { key: "ArrowRight" });
        expect(document.activeElement).toBe(card("4"));
        fireEvent.keyDown(card("4"), { key: "ArrowRight" }); // blocked is empty
        expect(document.activeElement).toBe(card("5"));
        fireEvent.keyDown(card("5"), { key: "End" });
        expect(document.activeElement).toBe(card("6"));
        fireEvent.keyDown(card("6"), { key: "Home", ctrlKey: true });
        expect(document.activeElement).toBe(card("1"));
    });

    it("Enter on a card opens it (the card's own handler), the arrows do not", () => {
        const onTaskClick = vi.fn();
        const { board } = setup(onTaskClick);
        const first = board.querySelector<HTMLElement>('[data-rfd-drag-handle-draggable-id="1"]')!;
        first.focus();
        fireEvent.keyDown(first, { key: "ArrowDown" });
        expect(onTaskClick).not.toHaveBeenCalled();
        const second = board.querySelector<HTMLElement>(
            '[data-rfd-drag-handle-draggable-id="2"]'
        )!;
        fireEvent.keyDown(second, { key: "Enter" });
        expect(onTaskClick).toHaveBeenCalledTimes(1);
        expect(onTaskClick.mock.calls[0][0].id).toBe("2");
    });

    it("stays silent while a card is lifted (the drag library owns the keys)", () => {
        const { board } = setup();
        const first = board.querySelector<HTMLElement>('[data-rfd-drag-handle-draggable-id="1"]')!;
        first.focus();
        board.setAttribute(BOARD_DRAGGING_ATTR, "true");
        fireEvent.keyDown(first, { key: "ArrowDown" });
        expect(document.activeElement).toBe(first);
        board.removeAttribute(BOARD_DRAGGING_ATTR);
        fireEvent.keyDown(first, { key: "ArrowDown" });
        expect(document.activeElement).not.toBe(first);
    });
});
