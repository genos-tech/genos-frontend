/**
 * A task delete that waits behind its Undo toast (MIP-1303) reads as Deleted in
 * `allTasks` at once, while the raw rows stay what the server holds.
 *
 * Two-sided, like the row-mirror contract next door: the SAME `allTasks` array
 * while nothing applies (a new identity re-runs the filter pipeline, the table's
 * tree indexes and the board), and a real overlay while a delete is pending.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { taskDeleteKey } from "../../features/tasks/utils/pendingTaskDelete";
import {
    __resetUndoables,
    flushUndoables,
    runUndoable,
} from "../../hooks/common/useUndoableAction";
import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => []),
}));

const myself = { userId: "u1", teamId: "t1", userName: "Me" } as UserProps;

const row = (id: number, status = "Open"): TaskTableProps =>
    ({
        id: String(id),
        title: `Task ${id}`,
        status,
        parentTaskId: null,
        rootTaskId: id,
        projectId: 10,
        tags: [],
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
    }) as unknown as TaskTableProps;

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

const setup = async (rows = [row(1), row(2)]) => {
    const view = renderHook(() => useTaskManagement(myself, "token"));
    act(() => view.result.current.setAllTasks(rows));
    await flush();
    return view;
};

const startDelete = (id: number, over: Partial<Parameters<typeof runUndoable>[0]> = {}) =>
    act(() =>
        runUndoable({
            key: taskDeleteKey(id),
            message: "Task deleted",
            errorMessage: "failed",
            commit: () => Promise.resolve(),
            keepOnNavigate: true,
            releaseOnCommit: true,
            ...over,
        })
    );

vi.useFakeTimers();
afterEach(() => {
    __resetUndoables();
    vi.clearAllMocks();
});

describe("allTasks while a task delete is pending", () => {
    it("is the SAME array when nothing is pending", async () => {
        const { result, rerender } = await setup();
        const before = result.current.allTasks;
        rerender();
        expect(result.current.allTasks).toBe(before);
    });

    it("shows the pending task as Deleted and leaves every other row and field alone", async () => {
        const { result } = await setup();
        const [a, b] = result.current.allTasks;
        startDelete(1);
        const [a2, b2] = result.current.allTasks;
        expect(a2.status).toBe("Deleted");
        expect(a2).toEqual({ ...a, status: "Deleted" });
        // The row that is not pending is the very same object.
        expect(b2).toBe(b);
    });

    it("is the same array for a pending key of another kind, or of a task not in these rows", async () => {
        const { result } = await setup();
        const before = result.current.allTasks;
        startDelete(1, { key: "task-comment:5:9" });
        expect(result.current.allTasks).toBe(before);
        startDelete(999);
        expect(result.current.allTasks).toBe(before);
    });

    it("refuses to open the pending task's preview, and opens the others", async () => {
        const { result } = await setup();
        startDelete(1);
        act(() => result.current.setCurrentPreviewTaskId(1));
        expect(result.current.currentPreviewTaskId).toBe(-1);
        act(() => result.current.setCurrentPreviewTaskId(2));
        expect(result.current.currentPreviewTaskId).toBe(2);
        // Closing is never refused.
        act(() => result.current.setCurrentPreviewTaskId(-1));
        expect(result.current.currentPreviewTaskId).toBe(-1);
    });

    it("Undo puts the row back as it was", async () => {
        const { result } = await setup();
        const before = result.current.allTasks;
        startDelete(1);
        expect(result.current.allTasks[0].status).toBe("Deleted");
        // Undo through the keyboard path the module installs (Cmd/Ctrl+Z).
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", metaKey: true }));
        });
        expect(result.current.allTasks[0].status).toBe("Open");
        expect(result.current.allTasks).toEqual(before);
    });

    it("the commit writes Deleted into the raw row, then releases: a later status pick sticks", async () => {
        const { result } = await setup();
        startDelete(1, {
            // What `useDeleteTask` does before the key is released.
            onCommitted: () =>
                result.current.setAllTasks((prev) =>
                    prev.map((r) => (r.id === "1" ? { ...r, status: "Deleted" } : r))
                ),
        });
        expect(result.current.allTasks[0].status).toBe("Deleted");
        // The window ends (no toast host here to run its timer: end it directly).
        await act(async () => {
            flushUndoables("next");
            await vi.advanceTimersByTimeAsync(10);
        });
        // Released, and still Deleted: now the raw row says so.
        expect(result.current.allTasks[0].status).toBe("Deleted");

        // Bring it back from the status picker (Deleted -> Open): NOT overlaid again.
        act(() =>
            result.current.setAllTasks((prev) =>
                prev.map((r) => (r.id === "1" ? { ...r, status: "Open" } : r))
            )
        );
        expect(result.current.allTasks[0].status).toBe("Open");
    });

    it("a refetch during the window cannot resurrect it", async () => {
        const { result } = await setup();
        startDelete(1);
        // A refetch lands server rows (the task is still Open there).
        act(() => result.current.setAllTasks([row(1), row(2)]));
        expect(result.current.allTasks[0].status).toBe("Deleted");
    });
});
