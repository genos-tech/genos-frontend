import { useRef } from "react";
import { DragDropContext } from "@hello-pangea/dnd";
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render } from "@testing-library/react";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

import { SprintBoardColumn } from "../features/tasks/components/board/SprintBoardColumn";
import { COLUMNS } from "../features/tasks/components/board/sprintBoardHelpers";
import { useBoardRovingNav } from "../features/tasks/components/board/useBoardRovingNav";
import {
    nearEnd,
    RENDER_ALL_UP_TO,
    RENDER_STEP,
    renderLimit,
} from "../features/tasks/utils/renderOnScroll";
import type { UserProps } from "../types/admin";
import type { TaskTableProps } from "../types/tasks";

vi.mock("../context/AuthContext", () => ({
    useAuth: () => ({ accessToken: "test-token" }),
}));

// MIP-1985: a board column with ~570 Closed cards drew every card on open. A long column
// now draws the first chunk and adds a chunk as it is scrolled or keyed down to its end;
// the cards drawn are always a prefix of the column's list.

const myself = { userId: "u1", teamId: "t1" } as unknown as UserProps;
const task = (id: number): TaskTableProps =>
    ({
        id: String(id),
        displayId: `PRJ-${id}`,
        title: `Card ${id}`,
        status: "Closed",
        parentTaskId: null,
        rootTaskId: null,
        projectId: 1,
        tags: [],
        isMilestone: false,
        milestoneId: null,
    }) as unknown as TaskTableProps;

const closed = COLUMNS.find((c) => c.status === "Closed")!;

const Board = ({ count }: { count: number }) => {
    const boardRef = useRef<HTMLDivElement>(null);
    const ref = useBoardRovingNav(boardRef);
    return (
        <CssVarsProvider>
            <DragDropContext onDragEnd={() => {}}>
                <div ref={ref}>
                    <SprintBoardColumn
                        column={closed}
                        myself={myself}
                        tasks={Array.from({ length: count }, (_, i) => task(i + 1))}
                        teamMemberProfiles={{}}
                    />
                </div>
            </DragDropContext>
        </CssVarsProvider>
    );
};

const cards = (c: HTMLElement) => c.querySelectorAll("[data-rfd-drag-handle-draggable-id]");

describe("renderLimit", () => {
    it("draws everything up to the threshold, then a prefix that grows by one step", () => {
        expect(renderLimit(RENDER_ALL_UP_TO, 0)).toBe(RENDER_ALL_UP_TO);
        expect(renderLimit(RENDER_ALL_UP_TO + 1, 0)).toBe(RENDER_STEP);
        expect(renderLimit(600, 1)).toBe(2 * RENDER_STEP);
        expect(renderLimit(100, 5)).toBe(100);
        expect(renderLimit(600, Number.MAX_SAFE_INTEGER / RENDER_STEP)).toBe(600);
    });

    it("asks for more only when the scroller is near its end", () => {
        expect(nearEnd({ scrollTop: 0, clientHeight: 500, scrollHeight: 5000 })).toBe(false);
        expect(nearEnd({ scrollTop: 4000, clientHeight: 500, scrollHeight: 5000 })).toBe(true);
    });
});

// jsdom has no layout (every size is 0, which reads as "at the end"): give the scrollers a tall
// content and a short viewport, scrolled to the top.
const sizeOf = (name: "scrollHeight" | "clientHeight", value: number) => {
    const original = Object.getOwnPropertyDescriptor(HTMLElement.prototype, name);
    Object.defineProperty(HTMLElement.prototype, name, { configurable: true, get: () => value });
    return () => {
        if (original) Object.defineProperty(HTMLElement.prototype, name, original);
        else delete (HTMLElement.prototype as unknown as Record<string, unknown>)[name];
    };
};
const restores: Array<() => void> = [];

describe("a long board column", { timeout: 60_000 }, () => {
    beforeAll(() => {
        restores.push(sizeOf("scrollHeight", 50_000), sizeOf("clientHeight", 500));
    });
    afterAll(() => restores.forEach((r) => r()));

    it("draws only the first chunk of 140 cards", () => {
        const { container } = render(<Board count={140} />);
        expect(cards(container)).toHaveLength(RENDER_STEP);
        // The header count is the column's, not the drawn cards'.
        expect(container.textContent).toContain("140");
    });

    it("draws every card of a short column", () => {
        const { container } = render(<Board count={RENDER_ALL_UP_TO} />);
        expect(cards(container)).toHaveLength(RENDER_ALL_UP_TO);
    });

    it("adds a chunk when the column is scrolled near its end", () => {
        const { container } = render(<Board count={140} />);
        const scroller = container.querySelector("[data-rfd-droppable-id]") as HTMLElement;
        Object.defineProperty(scroller, "scrollTop", { configurable: true, value: 49_000 });
        fireEvent.scroll(scroller);
        expect(cards(container).length).toBeGreaterThan(RENDER_STEP);
    });

    it("keeps the cards in list order (a prefix)", () => {
        const { container } = render(<Board count={140} />);
        const ids = Array.from(cards(container)).map((c) =>
            c.getAttribute("data-rfd-drag-handle-draggable-id")
        );
        expect(ids).toEqual(Array.from({ length: RENDER_STEP }, (_, i) => String(i + 1)));
    });

    it("draws the next chunk when ArrowDown is pressed on the last drawn card", () => {
        const { container } = render(<Board count={140} />);
        const all = cards(container);
        const last = all[all.length - 1] as HTMLElement;
        last.focus();
        fireEvent.keyDown(last, { key: "ArrowDown" });
        expect(cards(container).length).toBeGreaterThan(RENDER_STEP);
    });

    it("draws the whole column on End", () => {
        const { container } = render(<Board count={140} />);
        const first = cards(container)[0] as HTMLElement;
        first.focus();
        fireEvent.keyDown(first, { key: "End" });
        expect(cards(container)).toHaveLength(140);
    });
});
