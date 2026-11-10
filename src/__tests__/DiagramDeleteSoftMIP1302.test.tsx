/**
 * MIP-1302 + MIP-1303: deleting a task from the graph is the preview's delete (a soft one,
 * status Deleted, so the task, its comments and its sub-tasks stay in the database), and it
 * waits behind an Undo toast.
 *
 * The card leaves the canvas at once (the canvas lays the graph out with a pending delete
 * shown as Deleted), nothing is sent while the toast is up, Undo brings the card back, and
 * when the window ends ONE `PUT /task/ {task_id, status, status_code}` goes out. A refused
 * write brings the card back.
 *
 * The node card's own Delete entry (its status menu) is tested next door
 * (`DeletedStatusConfirmMIP1301`); the mocked card below stands in for whatever calls
 * `data.onDelete()`.
 */
import { CssVarsProvider } from "@mui/joy/styles";
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { TaskFlowCanvas } from "../features/tasks/diagram/components/TaskFlowCanvas";
import { __resetUndoables, flushUndoables } from "../hooks/common/useUndoableAction";
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
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => []),
}));
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

// What the server holds: a task the (mocked) PUT marked Deleted reads Deleted on the next load.
const deletedOnServer = new Set<string>();
const graph = () => ({
    rootTaskId: 1,
    tasks: [row(1, null), row(2, 1)].map((t) =>
        deletedOnServer.has(String(t.id)) ? { ...t, status: "Deleted" } : t
    ),
    externalTasks: [],
    dependencyEdges: [],
});

const setAllTasks = vi.fn();
const loadUpdatedTask = vi.fn().mockResolvedValue(undefined);

const onOverviewChange = vi.fn();
/** The last overview the canvas gave the modal header ("closed/total"). */
const lastOverview = () =>
    onOverviewChange.mock.calls.at(-1)?.[0] as { total: number; closed: number } | undefined;

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
                            allTasks: [],
                            currentPreviewKind: "task",
                            currentPreviewTaskId: -1,
                            setAllTasks,
                            loadUpdatedTask,
                        } as never
                    }
                    onCloseModal={vi.fn()}
                    onOverviewChange={onOverviewChange}
                />
            </div>
        </CssVarsProvider>
    );

const deleteCard = async (id: number) =>
    fireEvent.click(await screen.findByTestId(`delete-${id}`));
const endWindow = async () => {
    await act(async () => {
        flushUndoables("next");
    });
};

describe("graph delete", () => {
    beforeEach(() => {
        loadTaskGraph.mockReset();
        loadTaskGraph.mockImplementation(async () => graph());
        deletedOnServer.clear();
        patchTaskFields.mockReset();
        patchTaskFields.mockImplementation(async (id: number) => {
            deletedOnServer.add(String(id));
            return { ok: true };
        });
        setAllTasks.mockReset();
        onOverviewChange.mockReset();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });
    afterEach(() => {
        cleanup();
        __resetUndoables();
    });

    it("the card leaves the canvas at once, with no confirm and nothing sent", async () => {
        renderCanvas();
        await deleteCard(2);
        await waitFor(() => expect(screen.queryByTestId("delete-2")).toBeNull());
        // The sibling stays, and no dialog was asked.
        expect(screen.getByTestId("delete-1")).toBeTruthy();
        expect(screen.queryByRole("alertdialog")).toBeNull();
        expect(patchTaskFields).not.toHaveBeenCalled();
    });

    it("Undo brings the card back and sends nothing", async () => {
        renderCanvas();
        await deleteCard(2);
        await waitFor(() => expect(screen.queryByTestId("delete-2")).toBeNull());
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
        });
        expect(await screen.findByTestId("delete-2")).toBeTruthy();
        await endWindow();
        expect(patchTaskFields).not.toHaveBeenCalled();
    });

    it("when the window ends, marks the task Deleted with ONE minimal PUT and the card stays gone", async () => {
        renderCanvas();
        await deleteCard(2);
        await waitFor(() => expect(screen.queryByTestId("delete-2")).toBeNull());
        await endWindow();

        await waitFor(() => expect(patchTaskFields).toHaveBeenCalledTimes(1));
        expect(patchTaskFields).toHaveBeenCalledWith(
            2,
            { status: "Deleted", status_code: 0 },
            "tok"
        );
        // The mirror into the table's rows, like any status change from the graph.
        expect(setAllTasks).toHaveBeenCalled();
        // The overlay is let go of after the commit, and the card still does not return:
        // the graph itself now says Deleted.
        await waitFor(() => expect(screen.queryByTestId("delete-2")).toBeNull());
        expect(screen.getByTestId("delete-1")).toBeTruthy();
    });

    it("a refresh of the graph during the window does not bring the card back", async () => {
        renderCanvas();
        await deleteCard(2);
        await waitFor(() => expect(screen.queryByTestId("delete-2")).toBeNull());
        // The server still says Open (nothing was sent): a re-layout from a fresh load.
        await act(async () => {
            window.dispatchEvent(
                new CustomEvent("genos:task-touched", { detail: { taskId: 1, kind: "update" } })
            );
        });
        await waitFor(() => expect(loadTaskGraph.mock.calls.length).toBeGreaterThan(1));
        expect(screen.queryByTestId("delete-2")).toBeNull();
    });

    it("puts the card back when the server refuses", async () => {
        patchTaskFields.mockResolvedValue({ ok: false });
        renderCanvas();
        await deleteCard(2);
        await waitFor(() => expect(screen.queryByTestId("delete-2")).toBeNull());
        await endWindow();

        expect(await screen.findByTestId("delete-2")).toBeTruthy();
        expect(setAllTasks).not.toHaveBeenCalled();
    });

    it("the header counter leaves the pending card out at once, and Undo counts it again", async () => {
        renderCanvas();
        await waitFor(() => expect(lastOverview()?.total).toBe(1));
        await deleteCard(2);
        await waitFor(() => expect(lastOverview()?.total).toBe(0));
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
        });
        await waitFor(() => expect(lastOverview()?.total).toBe(1));
    });

    it("a refresh of the graph in the window keeps the counter without the pending card", async () => {
        renderCanvas();
        await deleteCard(2);
        await waitFor(() => expect(lastOverview()?.total).toBe(0));
        // The server still says Open: the fresh load must not count the card again.
        await act(async () => {
            window.dispatchEvent(
                new CustomEvent("genos:task-touched", { detail: { taskId: 1, kind: "update" } })
            );
        });
        await waitFor(() => expect(loadTaskGraph.mock.calls.length).toBeGreaterThan(1));
        expect(lastOverview()?.total).toBe(0);
    });

    it("after the commit the counter stays without the card", async () => {
        renderCanvas();
        await deleteCard(2);
        await waitFor(() => expect(lastOverview()?.total).toBe(0));
        await endWindow();
        await waitFor(() => expect(patchTaskFields).toHaveBeenCalledTimes(1));
        await waitFor(() => expect(screen.queryByTestId("delete-2")).toBeNull());
        expect(lastOverview()?.total).toBe(0);
    });
});
