/**
 * MIP-1278: hovering a card on the real task-graph canvas (the rule itself is in
 * TaskGraphLineageMIP1278.test.tsx). A hover reaches the cards as `isInLineage`,
 * dims the others, lights the parent-child lines on the chain, and leaving puts
 * everything back.
 */
import { useSyncExternalStore } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFlowCanvas } from "../features/tasks/diagram/components/TaskFlowCanvas";
import { DIMMED_OPACITY } from "../features/tasks/diagram/utils/lineage";
import type { TaskTableProps } from "../types/tasks";

const loadTaskGraph = vi.fn();
vi.mock("../features/tasks/diagram/services/loadTaskGraph", () => ({
    loadTaskGraph: (...args: unknown[]) => loadTaskGraph(...args),
}));
vi.mock("../features/tasks/services/addTask", () => ({ addTask: vi.fn() }));
vi.mock("../db/services/task-full.service", () => ({ invalidateCachedFullTask: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
// Stub cards: they show what the canvas told them. `TaskNodeView` itself is
// covered below.
vi.mock("../features/tasks/diagram/components/TaskNodeCard", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("../features/tasks/diagram/components/TaskNodeCard")
    >()),
    TaskNodeCard: ({ data }: { data: { task: { id: string }; isInLineage?: boolean } }) => (
        <div data-lit={String(!!data.isInLineage)} data-testid={`card-${data.task.id}`}>
            {data.task.id}
        </div>
    ),
}));
vi.mock("../features/tasks/diagram/components/MilestoneNodeCard", async (importOriginal) => ({
    ...(await importOriginal<
        typeof import("../features/tasks/diagram/components/MilestoneNodeCard")
    >()),
    MilestoneNodeCard: ({ data }: { data: { task: { id: string }; isInLineage?: boolean } }) => (
        <div data-lit={String(!!data.isInLineage)} data-testid={`card-${data.task.id}`}>
            {data.task.id}
        </div>
    ),
}));
// Edges only draw once React Flow has measured the handles, which jsdom can't. The real
// ReactFlow still draws and drives the cards; beside it a probe lists the `edges` it was
// handed, so the lines' hover state can be read.
const drawing = vi.hoisted(() => {
    const listeners = new Set<() => void>();
    const state = {
        on: false,
        set(on: boolean) {
            state.on = on;
            listeners.forEach((l) => l());
        },
        subscribe(l: () => void) {
            listeners.add(l);
            return () => listeners.delete(l);
        },
    };
    return state;
});
vi.mock("@xyflow/react", async (importOriginal) => {
    const actual = await importOriginal<typeof import("@xyflow/react")>();
    const ReactFlow = (props: React.ComponentProps<typeof actual.ReactFlow>) => (
        <>
            <actual.ReactFlow {...props} />
            {(props.edges ?? []).map((e) => (
                <i
                    key={e.id}
                    data-lineage={(e.data as { lineage?: string }).lineage ?? ""}
                    data-testid={`edge-${e.id}`}
                    data-z={e.zIndex ?? ""}
                />
            ))}
        </>
    );
    // Whether a line is being drawn is React Flow's own state; the test sets it.
    const useConnection = (select: (c: { inProgress: boolean }) => unknown) =>
        select({ inProgress: useSyncExternalStore(drawing.subscribe, () => drawing.on) });
    return { ...actual, ReactFlow, useConnection };
});

vi.stubGlobal(
    "ResizeObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

// --- the real canvas --------------------------------------------------------------

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
                    useTM={{ currentPreviewTaskId: -1, setAllTasks: vi.fn() } as never}
                    onCloseModal={vi.fn()}
                />
            </div>
        </CssVarsProvider>
    );

const wrapperOf = (id: number) =>
    screen.getByTestId(`card-${id}`).closest(".react-flow__node") as HTMLElement;
const lit = (id: number) => screen.getByTestId(`card-${id}`).getAttribute("data-lit");
const dimmed = (id: number) => wrapperOf(id).style.opacity === String(DIMMED_OPACITY);

describe("hovering a card on the canvas", () => {
    beforeEach(() => {
        drawing.set(false);
        loadTaskGraph.mockReset();
        loadTaskGraph.mockImplementation(async () => ({
            rootTaskId: 1,
            tasks: [
                row(1, null, true),
                row(2, 1),
                row(3, 1),
                row(4, 2),
                row(5, 2),
                row(6, 4),
                row(9, null),
            ],
            externalTasks: [],
            dependencyEdges: [],
        }));
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("lights its parents and children, dims the rest, and restores on leave", async () => {
        renderCanvas();
        await screen.findByTestId("card-4");

        fireEvent.mouseEnter(wrapperOf(4));
        await waitFor(() => expect(lit(4)).toBe("true"));
        for (const id of [1, 2, 6]) expect(lit(id)).toBe("true");
        for (const id of [3, 5, 9]) {
            expect(lit(id)).toBe("false");
            expect(dimmed(id)).toBe(true);
        }
        for (const id of [1, 2, 4, 6]) expect(dimmed(id)).toBe(false);

        fireEvent.mouseLeave(wrapperOf(4));
        await waitFor(() => expect(lit(4)).toBe("false"));
        for (const id of [1, 2, 3, 4, 5, 6, 9]) {
            expect(lit(id)).toBe("false");
            expect(dimmed(id)).toBe(false);
        }
    });

    it("lights the parent-child lines on the chain and dims the others", async () => {
        renderCanvas();
        await screen.findByTestId("card-4");
        const line = (id: string) =>
            screen.queryByTestId(`edge-${id}`)?.getAttribute("data-lineage");
        await waitFor(() => expect(line("s-2-4")).toBe(""));

        fireEvent.mouseEnter(wrapperOf(4));
        await waitFor(() => expect(line("s-2-4")).toBe("active"));
        expect(line("s-1-2")).toBe("active");
        expect(line("s-4-6")).toBe("active");
        expect(line("s-2-5")).toBe("dim");
        expect(line("s-1-3")).toBe("dim");
        expect(screen.getByTestId("edge-s-2-4").getAttribute("data-z")).toBe("1000");
        expect(screen.getByTestId("edge-s-2-5").getAttribute("data-z")).toBe("");

        fireEvent.mouseLeave(wrapperOf(4));
        await waitFor(() => expect(line("s-2-4")).toBe(""));
        expect(line("s-2-5")).toBe("");
    });

    it("lights nothing while a line is being drawn, and again once it ends", async () => {
        renderCanvas();
        await screen.findByTestId("card-4");
        fireEvent.mouseEnter(wrapperOf(4));
        await waitFor(() => expect(lit(4)).toBe("true"));

        // A line starts from a handle: the pointer is still over the card.
        act(() => drawing.set(true));
        await waitFor(() => expect(lit(4)).toBe("false"));
        for (const id of [1, 2, 3, 4, 5, 6, 9]) expect(dimmed(id)).toBe(false);

        // Moving over another card while drawing lights nothing either.
        fireEvent.mouseEnter(wrapperOf(3));
        await new Promise((r) => setTimeout(r, 50));
        expect(lit(3)).toBe("false");

        // The line ends over that card: now it is the hovered one.
        act(() => drawing.set(false));
        await waitFor(() => expect(lit(3)).toBe("true"));
        expect(lit(1)).toBe("true");
        expect(dimmed(4)).toBe(true);
    });

    it("moves the highlight to the next card without waiting for a leave", async () => {
        renderCanvas();
        await screen.findByTestId("card-3");

        fireEvent.mouseEnter(wrapperOf(6));
        await waitFor(() => expect(lit(6)).toBe("true"));
        fireEvent.mouseEnter(wrapperOf(3));
        await waitFor(() => expect(lit(3)).toBe("true"));
        expect(lit(1)).toBe("true");
        expect(lit(6)).toBe("false");
        expect(dimmed(6)).toBe(true);
    });

    it("lights the whole tree when the milestone is hovered", async () => {
        renderCanvas();
        await screen.findByTestId("card-1");

        fireEvent.mouseEnter(wrapperOf(1));
        await waitFor(() => expect(lit(1)).toBe("true"));
        for (const id of [2, 3, 4, 5, 6]) expect(lit(id)).toBe("true");
        expect(dimmed(9)).toBe(true);
    });

    it("leaves everything alone for a card with nothing connected", async () => {
        renderCanvas();
        await screen.findByTestId("card-9");

        fireEvent.mouseEnter(wrapperOf(9));
        for (const id of [1, 2, 3, 4, 5, 6, 9]) {
            expect(lit(id)).toBe("false");
            expect(dimmed(id)).toBe(false);
        }
    });
});
