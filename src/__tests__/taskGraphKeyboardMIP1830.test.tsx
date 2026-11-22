/**
 * MIP-1830 (decision note task:219, option A): the task graph by keyboard.
 *
 * - Each card is ONE Tab stop, named by the card (its id, title and status).
 *   The controls inside a card (status menu, date editor, open, add) are out of
 *   the tab order: the preview they open has them all.
 * - Enter or Space on a focused card opens its preview.
 * - Arrow keys move focus to a card linked to it by a dependency or a parent,
 *   in the arrow's direction. They never move a card (mouse and touch still do).
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFlowCanvas } from "../features/tasks/diagram/components/TaskFlowCanvas";
import { linkedCardInDirection } from "../features/tasks/diagram/utils/cardKeyboard";
import type { TaskTableProps } from "../types/tasks";

// --- the pure rule ----------------------------------------------------------------

describe("linkedCardInDirection", () => {
    // A tree: 1 on top, 2 and 3 below it, 4 below 2. 5 is below 4 but not linked to 4.
    const cards = [
        { id: "1", x: 100, y: 0, width: 200, height: 100 },
        { id: "2", x: 0, y: 200, width: 200, height: 100 },
        { id: "3", x: 220, y: 200, width: 200, height: 100 },
        { id: "4", x: 0, y: 400, width: 200, height: 100 },
        { id: "5", x: 0, y: 600, width: 200, height: 100 },
    ];
    const links = [
        { source: "1", target: "2" },
        { source: "1", target: "3" },
        { source: "2", target: "4" },
    ];

    it("moves down to a linked card below", () => {
        expect(linkedCardInDirection("1", "ArrowDown", cards, links)).toBe("2");
    });

    it("moves up to the parent", () => {
        expect(linkedCardInDirection("4", "ArrowUp", cards, links)).toBe("2");
    });

    it("never lands on an unlinked card, however close", () => {
        // 5 is directly below 4 but not linked to it.
        expect(linkedCardInDirection("4", "ArrowDown", cards, links)).toBeNull();
    });

    it("does not step sideways to a sibling: siblings are linked only through the parent", () => {
        expect(linkedCardInDirection("2", "ArrowRight", cards, links)).not.toBe("3");
        expect(linkedCardInDirection("3", "ArrowLeft", cards, links)).not.toBe("2");
    });

    it("returns null when the card has no link in that direction", () => {
        expect(linkedCardInDirection("4", "ArrowRight", cards, links)).toBeNull();
    });

    it("returns null for an unknown card", () => {
        expect(linkedCardInDirection("99", "ArrowDown", cards, links)).toBeNull();
    });
});

// --- the real canvas --------------------------------------------------------------

const loadTaskGraph = vi.fn();
vi.mock("../features/tasks/diagram/services/loadTaskGraph", () => ({
    loadTaskGraph: (...args: unknown[]) => loadTaskGraph(...args),
}));
vi.mock("../features/tasks/services/addTask", () => ({ addTask: vi.fn() }));
vi.mock("../db/services/task-full.service", () => ({ invalidateCachedFullTask: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
// Stub cards: a plain focusable-free body, so the node wrapper React Flow draws is
// the only focus target (the real card is covered by the TaskNodeView test below).
vi.mock("../features/tasks/diagram/components/TaskNodeCard", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("../features/tasks/diagram/components/TaskNodeCard")
    >()),
    TaskNodeCard: ({ data }: { data: { task: { id: string } } }) => (
        <div data-testid={`card-${data.task.id}`}>{data.task.id}</div>
    ),
}));
vi.mock("../features/tasks/diagram/components/MilestoneNodeCard", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("../features/tasks/diagram/components/MilestoneNodeCard")
    >()),
    MilestoneNodeCard: ({ data }: { data: { task: { id: string } } }) => (
        <div data-testid={`card-${data.task.id}`}>{data.task.id}</div>
    ),
}));

vi.stubGlobal(
    "ResizeObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

const row = (id: number, parentTaskId: number | null, isMilestone = false): TaskTableProps =>
    ({
        id: String(id),
        title: `task ${id}`,
        status: "Open",
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        projectId: 1,
        tags: [],
        isMilestone,
    }) as unknown as TaskTableProps;

const setCurrentPreviewTaskId = vi.fn();
const onCloseModal = vi.fn();

const renderCanvas = () =>
    render(
        <CssVarsProvider>
            <div style={{ width: 800, height: 600 }}>
                <TaskFlowCanvas
                    hideClosed={false}
                    myself={{ userId: "u1", teamId: "t1" } as never}
                    projectId={1}
                    rootTaskId={1}
                    usePM={{} as never}
                    useTM={
                        {
                            currentPreviewTaskId: -1,
                            setAllTasks: vi.fn(),
                            setCurrentPreviewTaskId,
                        } as never
                    }
                    onCloseModal={onCloseModal}
                />
            </div>
        </CssVarsProvider>
    );

const wrapperOf = (id: number) =>
    document.querySelector(`.react-flow__node[data-id="${id}"]`) as HTMLElement;

describe("the task graph by keyboard (canvas)", () => {
    beforeEach(() => {
        loadTaskGraph.mockReset();
        setCurrentPreviewTaskId.mockReset();
        onCloseModal.mockReset();
        loadTaskGraph.mockImplementation(async () => ({
            rootTaskId: 1,
            tasks: [row(1, null, true), row(2, 1), row(3, 1), row(4, 2), row(9, null)],
            externalTasks: [],
            dependencyEdges: [],
        }));
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("gives each card one Tab stop with a name that says what it is", async () => {
        renderCanvas();
        await waitFor(() => expect(wrapperOf(4)).not.toBeNull());
        const card = wrapperOf(4);
        expect(card.getAttribute("tabindex")).toBe("0");
        expect(card.getAttribute("aria-label")).toContain("task 4");
        expect(card.getAttribute("aria-label")).toContain("Open");
    });

    it('does not announce a card as a "node" (MIP-1928): React Flow\'s roledescription is removed', async () => {
        renderCanvas();
        await waitFor(() => expect(wrapperOf(4)).not.toBeNull());
        const card = wrapperOf(4);
        expect(card.getAttribute("role")).toBe("button");
        expect(card.getAttribute("aria-roledescription")).toBeNull();
    });

    it("moves focus to the linked card above with ArrowUp, and never moves the card", async () => {
        renderCanvas();
        await waitFor(() => expect(wrapperOf(4)).not.toBeNull());
        const child = wrapperOf(4);
        const before = child.style.transform;
        act(() => child.focus());
        fireEvent.keyDown(child, { key: "ArrowUp" });
        expect(document.activeElement).toBe(wrapperOf(2));
        expect(child.style.transform).toBe(before);
    });

    it("does not move focus to a card that is not linked", async () => {
        renderCanvas();
        await waitFor(() => expect(wrapperOf(9)).not.toBeNull());
        const lone = wrapperOf(9);
        act(() => lone.focus());
        fireEvent.keyDown(lone, { key: "ArrowDown" });
        expect(document.activeElement).toBe(lone);
    });

    it("opens the card's preview with Enter and with Space", async () => {
        renderCanvas();
        await waitFor(() => expect(wrapperOf(3)).not.toBeNull());
        const card = wrapperOf(3);
        act(() => card.focus());
        fireEvent.keyDown(card, { key: "Enter" });
        expect(setCurrentPreviewTaskId).toHaveBeenLastCalledWith(3);
        fireEvent.keyDown(card, { key: " " });
        expect(setCurrentPreviewTaskId).toHaveBeenCalledTimes(2);
        expect(setCurrentPreviewTaskId).toHaveBeenLastCalledWith(3);
    });
});
