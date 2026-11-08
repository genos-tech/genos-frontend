/**
 * MIP-1302: deleting a task from the graph is the preview's delete, not a hard delete.
 *
 * `DELETE /task/` removed the row together with its comments and left its sub-tasks
 * pointing at a parent that no longer existed (`parent_task_id` is a plain integer, not a
 * foreign key), and the confirm said "and all its sub-tasks". Now the confirm runs the same
 * status change every status edit in the graph runs (status Deleted, code 0), through
 * `patchTaskFields` (`PUT /task/`), and the copy says what happens to the sub-tasks.
 *
 * The node card has no Delete control today, so the mocked card below stands in for
 * whatever calls `data.onDelete()`.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFlowCanvas } from "../features/tasks/diagram/components/TaskFlowCanvas";
import { en } from "../i18n/locales/en";
import type { TaskTableProps } from "../types/tasks";

const loadTaskGraph = vi.fn();
const patchTaskFields = vi.fn();
vi.mock("../features/tasks/diagram/services/loadTaskGraph", () => ({
    loadTaskGraph: (...args: unknown[]) => loadTaskGraph(...args),
}));
vi.mock("../features/tasks/diagram/services/patchTaskFields", () => ({
    patchTaskFields: (...args: unknown[]) => patchTaskFields(...args),
}));
// The browser-side caches (IndexedDB) are not under test; jsdom has none.
vi.mock("../features/tasks/services/addTask", () => ({ addTask: vi.fn() }));
vi.mock("../db/services/task-full.service", () => ({ invalidateCachedFullTask: vi.fn() }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: "tok" }) }));
vi.mock("../features/tasks/diagram/components/TaskNodeCard", () => ({
    TaskNodeCard: ({ data }: { data: { task: { id: string }; onDelete: () => void } }) => (
        <button data-testid={`delete-${data.task.id}`} onClick={() => data.onDelete()}>
            delete
        </button>
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
        tags: [],
    }) as unknown as TaskTableProps;

const graph = () => ({
    rootTaskId: 1,
    tasks: [row(1, null), row(2, 1)],
    externalTasks: [],
    dependencyEdges: [],
});

const setAllTasks = vi.fn();
const loadUpdatedTask = vi.fn().mockResolvedValue(undefined);

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
                            setAllTasks,
                            loadUpdatedTask,
                        } as never
                    }
                    onCloseModal={vi.fn()}
                />
            </div>
        </CssVarsProvider>
    );

const askToDelete = async (id: number) => {
    fireEvent.click(await screen.findByTestId(`delete-${id}`));
    return screen.findByText(en.tasks.diagram.confirmDelete);
};
const confirm = () =>
    fireEvent.click(screen.getByRole("button", { name: en.common.actions.delete }));

describe("graph delete", () => {
    beforeEach(() => {
        loadTaskGraph.mockReset();
        loadTaskGraph.mockImplementation(async () => graph());
        patchTaskFields.mockReset();
        patchTaskFields.mockResolvedValue({ ok: true });
        setAllTasks.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("marks the task Deleted through PUT, then reloads the graph", async () => {
        renderCanvas();
        await askToDelete(2);
        const loadsBefore = loadTaskGraph.mock.calls.length;
        confirm();

        await waitFor(() => expect(patchTaskFields).toHaveBeenCalledTimes(1));
        expect(patchTaskFields).toHaveBeenCalledWith(
            2,
            { status: "Deleted", status_code: 0 },
            "tok"
        );
        // The mirror into the table's rows, like any status change from the graph.
        expect(setAllTasks).toHaveBeenCalled();
        await waitFor(() => expect(loadTaskGraph.mock.calls.length).toBeGreaterThan(loadsBefore));
    });

    it("keeps the task when the server refuses, and says so", async () => {
        patchTaskFields.mockResolvedValue({ ok: false });
        renderCanvas();
        await askToDelete(2);
        const loadsBefore = loadTaskGraph.mock.calls.length;
        confirm();

        expect(await screen.findByText(en.tasks.diagram.errors.delete)).toBeTruthy();
        // No reload: the graph must not pretend the task is gone.
        expect(loadTaskGraph.mock.calls.length).toBe(loadsBefore);
        expect(setAllTasks).not.toHaveBeenCalled();
    });

    it("the confirm says the sub-tasks are not deleted", async () => {
        renderCanvas();
        await askToDelete(1);
        expect(screen.getByText(en.tasks.diagram.confirmDeleteBody)).toBeTruthy();
        expect(en.tasks.diagram.confirmDelete).not.toMatch(/sub-tasks/i);
        expect(en.tasks.diagram.confirmDeleteBody).toMatch(/not deleted/i);
    });
});
