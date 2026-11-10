/**
 * MIP-1190: opening the task graph must settle, whatever the opener re-renders with.
 *
 * Twice an agent saw "Maximum update depth exceeded" when it opened the graph from an
 * in-page preview right after a stray click had opened the new-task form (an empty draft
 * is a real row, so the page behind the graph is busy re-rendering). It was never
 * reproduced: on main, with the new-task form open, the graph opens cleanly in a real
 * browser. What is pinned here is the one property such a loop would break: the canvas
 * loads and lays out the graph ONCE per open, however often the opener re-renders and
 * even when it hands over fresh `myself` / `useTM` / `usePM` / `useSM` objects each time
 * (hooks in the opener return new objects on every render).
 */
import { useState } from "react";
import { CssVarsProvider } from "@mui/joy/styles";
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ModalTaskDiagram } from "../features/tasks/diagram/components/ModalTaskDiagram";
import type { TaskTableProps } from "../types/tasks";

const loadTaskGraph = vi.fn();
vi.mock("../features/tasks/diagram/services/loadTaskGraph", () => ({
    loadTaskGraph: (...args: unknown[]) => loadTaskGraph(...args),
}));
vi.mock("../features/tasks/diagram/services/loadMilestoneBurndown", () => ({
    loadMilestoneBurndown: vi.fn().mockResolvedValue(null),
}));
vi.mock("../features/tasks/services/addTask", () => ({ addTask: vi.fn() }));
vi.mock("../db/services/task-full.service", () => ({ invalidateCachedFullTask: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/diagram/components/TaskNodeCard", () => ({
    TaskNodeCard: ({ data }: { data: { task: { id: string } } }) => (
        <div data-testid={`card-${data.task.id}`}>card</div>
    ),
}));
vi.mock("../features/tasks/diagram/components/MilestoneNodeCard", () => ({
    MilestoneNodeCard: () => null,
}));
vi.stubGlobal(
    "ResizeObserver",
    class {
        observe() {}
        unobserve() {}
        disconnect() {}
    }
);

const row = (id: number, parentTaskId: number | null): TaskTableProps =>
    ({
        id: String(id),
        title: `task ${id}`,
        status: "Open",
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        projectId: 1,
        dueDate: "2000-01-01",
        tags: [],
    }) as unknown as TaskTableProps;

const graph = () => ({
    rootTaskId: 1,
    tasks: [row(1, null), row(2, 1), row(3, 1)],
    externalTasks: [],
    dependencyEdges: [],
});

// An opener that re-renders on demand and, like a page full of hooks, builds every
// object it passes down anew each time.
let rerender: () => void = () => {};
const Opener = () => {
    const [, setTick] = useState(0);
    rerender = () => setTick((n) => n + 1);
    return (
        <ModalTaskDiagram
            myself={{ userId: "u1", teamId: "t1" } as never}
            open
            projectId={1}
            rootLabel="KDS-1 · One"
            rootTaskId={1}
            usePM={{ currentProject: { projectId: 1, projectName: "P" } } as never}
            useSM={{ projectSprints: {}, milestones: [] } as never}
            useTM={
                {
                    currentPreviewTaskId: -1,
                    setAllTasks: vi.fn(),
                    loadUpdatedTask: vi.fn().mockResolvedValue(undefined),
                    allTasks: [],
                } as never
            }
            onClose={vi.fn()}
        />
    );
};

describe("opening the graph", () => {
    let consoleError: ReturnType<typeof vi.spyOn>;
    beforeEach(() => {
        loadTaskGraph.mockReset();
        loadTaskGraph.mockImplementation(async () => graph());
        consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => consoleError.mockRestore());

    it("loads once and never trips React's update-depth guard while the opener re-renders", async () => {
        render(
            <CssVarsProvider>
                <Opener />
            </CssVarsProvider>
        );
        await screen.findByTestId("card-2");

        for (let i = 0; i < 25; i++) {
            await act(async () => {
                rerender();
            });
        }

        expect(loadTaskGraph).toHaveBeenCalledTimes(1);
        const depthErrors = consoleError.mock.calls.filter((c: unknown[]) =>
            String(c[0]).includes("Maximum update depth")
        );
        expect(depthErrors).toEqual([]);
        expect(screen.getByTestId("card-3")).toBeTruthy();
    }, 30000);
});
