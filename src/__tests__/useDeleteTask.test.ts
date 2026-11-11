/**
 * Delete a task with an Undo window (MIP-1303): `useDeleteTask`, on the real
 * `useTaskManagement` rows.
 *
 * What matters: the task reads Deleted at once and NOTHING is sent; Undo sends
 * nothing; when the window ends ONE write goes out and it is the minimal one
 * (`{task_id, status, status_code}`, never a working copy); the committed state
 * is in the rows before the overlay is released; a refused write puts the task
 * back.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useDeleteTask } from "../features/tasks/hooks/useDeleteTask";
import { __resetUndoables, flushUndoables } from "../hooks/common/useUndoableAction";
import { useTaskManagement } from "../hooks/tasks/useTaskManagement";
import { UserProps } from "../types/admin";
import { TaskTableProps } from "../types/tasks";

const put = vi.fn();
const addTask = vi.fn(async () => null);
const updateTaskCard = vi.fn(async () => undefined);
const invalidateCachedFullTask = vi.fn(async () => undefined);

const auth = vi.hoisted(() => ({ token: "tok" }));
vi.mock("../context/AuthContext", () => ({ useAuth: () => ({ accessToken: auth.token }) }));
vi.mock("../services/api", () => ({
    authApi: (token: string) => ({ put: (...a: unknown[]) => put(token, ...a) }),
}));
vi.mock("../features/tasks/services/addTask", () => ({ addTask: (r: unknown) => addTask(r) }));
vi.mock("../db/services/task-full.service", () => ({
    invalidateCachedFullTask: (id: number) => invalidateCachedFullTask(id),
    cacheFullTask: vi.fn(),
    getCachedFullTask: vi.fn(async () => undefined),
}));
vi.mock("../services/channel/channelService", () => ({
    channelService: { updateTaskCard: (...a: unknown[]) => updateTaskCard(...(a as [])) },
}));
vi.mock("../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => [
        {
            id: 1,
            displayId: "PRJ-1",
            title: "Task 1",
            status: { status: "Deleted" },
            priority: { priority: "High" },
            effortLevel: { level: "Low" },
            project: { projectId: 10, systemUserId: "sys" },
            assignee: null,
            reporter: { userName: "Me" },
        },
    ]),
}));

const myself = { userId: "u1", teamId: "t1", userName: "Me" } as UserProps;

const row = (id: number, over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id: String(id),
        title: `Task ${id}`,
        status: "Open",
        updatedAt: "2026-11-10 10:00:00",
        parentTaskId: null,
        rootTaskId: id,
        projectId: 10,
        tags: [],
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
        ...over,
    }) as unknown as TaskTableProps;

const flush = () =>
    act(async () => {
        for (let i = 0; i < 6; i++) await Promise.resolve();
        await vi.advanceTimersByTimeAsync(0);
    });

const setup = async (rows = [row(1), row(2)], useSM?: unknown) => {
    const view = renderHook(() => {
        const useTM = useTaskManagement(myself, "tok");
        const deleteTask = useDeleteTask({ useTM, useSM: useSM as never, myself });
        return { useTM, deleteTask };
    });
    act(() => view.result.current.useTM.setAllTasks(rows));
    await flush();
    return view;
};

const target = { id: 1, projectId: 10 };
const statusOf = (
    v: { result: { current: { useTM: { allTasks: TaskTableProps[] } } } },
    id = "1"
) => v.result.current.useTM.allTasks.find((r) => r.id === id)?.status;

beforeEach(() => {
    vi.useFakeTimers();
    auth.token = "tok";
    put.mockResolvedValue({ data: {} });
});
afterEach(() => {
    __resetUndoables();
    vi.clearAllMocks();
    vi.useRealTimers();
});

describe("useDeleteTask", () => {
    it("hides the task at once and sends nothing", async () => {
        const view = await setup();
        act(() => view.result.current.deleteTask(target));
        expect(statusOf(view)).toBe("Deleted");
        expect(statusOf(view, "2")).toBe("Open");
        await flush();
        expect(put).not.toHaveBeenCalled();
        expect(updateTaskCard).not.toHaveBeenCalled();
    });

    it("Undo sends nothing and puts the task back", async () => {
        const view = await setup();
        act(() => view.result.current.deleteTask(target));
        act(() => {
            window.dispatchEvent(new KeyboardEvent("keydown", { key: "z", ctrlKey: true }));
        });
        await flush();
        expect(statusOf(view)).toBe("Open");
        expect(put).not.toHaveBeenCalled();
    });

    it("when the window ends, ONE write goes out and it is only {task_id, status, status_code}", async () => {
        const view = await setup();
        act(() => view.result.current.deleteTask(target));
        await act(async () => {
            flushUndoables("next");
        });
        await flush();
        expect(put).toHaveBeenCalledTimes(1);
        expect(put).toHaveBeenCalledWith("tok", "/task/", {
            task_id: 1,
            status: "Deleted",
            status_code: 0,
        });
    });

    it("the committed state reaches the raw row, the IDB row and the PM card, and the task stays deleted", async () => {
        const view = await setup();
        act(() => view.result.current.deleteTask(target));
        await act(async () => {
            flushUndoables("next");
        });
        await flush();
        expect(statusOf(view)).toBe("Deleted");
        expect(addTask).toHaveBeenCalledWith(
            expect.objectContaining({ id: "1", status: "Deleted" })
        );
        expect(invalidateCachedFullTask).toHaveBeenCalledWith(1);
        // The card is rebuilt from the server's copy, which already says Deleted.
        expect(updateTaskCard).toHaveBeenCalledWith(
            1,
            expect.any(Array),
            "Task 1",
            expect.objectContaining({ taskId: 1, taskStatus: "Deleted" })
        );
    });

    it("after the commit the task can be brought back from the status picker (not overlaid again)", async () => {
        const view = await setup();
        act(() => view.result.current.deleteTask(target));
        await act(async () => {
            flushUndoables("next");
        });
        await flush();
        act(() =>
            view.result.current.useTM.setAllTasks((prev) =>
                prev.map((r) => (r.id === "1" ? { ...r, status: "WIP" } : r))
            )
        );
        expect(statusOf(view)).toBe("WIP");
    });

    it("the same task can be deleted again after it was brought back", async () => {
        const view = await setup();
        act(() => view.result.current.deleteTask(target));
        await act(async () => {
            flushUndoables("next");
        });
        await flush();
        act(() =>
            view.result.current.useTM.setAllTasks((prev) =>
                prev.map((r) => (r.id === "1" ? { ...r, status: "Open" } : r))
            )
        );
        act(() => view.result.current.deleteTask(target));
        expect(statusOf(view)).toBe("Deleted");
        await act(async () => {
            flushUndoables("next");
        });
        await flush();
        expect(put).toHaveBeenCalledTimes(2);
    });

    it("a refused write puts the task back", async () => {
        put.mockRejectedValue(new Error("403"));
        const view = await setup();
        act(() => view.result.current.deleteTask(target));
        await act(async () => {
            flushUndoables("next");
        });
        await flush();
        expect(statusOf(view)).toBe("Open");
        expect(addTask).not.toHaveBeenCalled();
    });

    it("an edit made during the window is not overwritten by the delete", async () => {
        const view = await setup();
        act(() => view.result.current.deleteTask(target));
        // Another surface renames the row while the toast is up.
        act(() =>
            view.result.current.useTM.setAllTasks((prev) =>
                prev.map((r) => (r.id === "1" ? { ...r, title: "Renamed meanwhile" } : r))
            )
        );
        await act(async () => {
            flushUndoables("next");
        });
        await flush();
        const body = put.mock.calls[0][2];
        expect(Object.keys(body).sort()).toEqual(["status", "status_code", "task_id"]);
        expect(view.result.current.useTM.allTasks[0].title).toBe("Renamed meanwhile");
    });

    it("closes the page's own preview when it shows that task, and only then", async () => {
        const view = await setup();
        act(() => view.result.current.useTM.setCurrentPreviewTaskId(2));
        act(() => view.result.current.deleteTask(target));
        expect(view.result.current.useTM.currentPreviewTaskId).toBe(2);
        act(() => view.result.current.useTM.setCurrentPreviewTaskId(-1));
        act(() => {
            flushUndoables("next");
        });
        await flush();
        // Delete 2 while it is the open preview.
        act(() => view.result.current.useTM.setCurrentPreviewTaskId(2));
        act(() => view.result.current.deleteTask({ id: 2, projectId: 10 }));
        expect(view.result.current.useTM.currentPreviewTaskId).toBe(-1);
    });

    it("a milestone is written through the milestone record, not PUT /task/", async () => {
        const updateExistingMilestone = vi.fn(async () => ({
            tsUpdatedAt: "2026-11-11 09:00:00",
        }));
        const view = await setup([row(1, { isMilestone: true, milestoneId: 5 })], {
            updateExistingMilestone,
        });
        act(() =>
            view.result.current.deleteTask({
                id: 1,
                projectId: 10,
                isMilestone: true,
                milestoneId: 5,
            })
        );
        expect(statusOf(view)).toBe("Deleted");
        await act(async () => {
            flushUndoables("next");
        });
        await flush();
        expect(updateExistingMilestone).toHaveBeenCalledWith(
            { milestoneId: 5, status: "Deleted" },
            10
        );
        expect(put).not.toHaveBeenCalled();
        expect(view.result.current.useTM.allTasks[0].updatedAt).toBe("2026-11-11 09:00:00");
    });
});

describe("useDeleteTask: what is read when the window ends", () => {
    it("uses the access token of the moment of the write, not of the click (it can refresh in the window)", async () => {
        const view = await setup();
        act(() => view.result.current.deleteTask(target));
        auth.token = "refreshed";
        view.rerender();
        await act(async () => {
            flushUndoables("next");
        });
        await flush();
        expect(put).toHaveBeenCalledWith("refreshed", "/task/", expect.anything());
    });

    it("the page going away: a task is PUT by keepalive fetch, a milestone through its own record", async () => {
        const fetchSpy = vi.fn(async () => ({}) as Response);
        vi.stubGlobal("fetch", fetchSpy);
        try {
            const view = await setup([row(1), row(2, { isMilestone: true, milestoneId: 5 })]);
            act(() => view.result.current.deleteTask(target));
            act(() => flushUndoables("exit"));
            expect(fetchSpy).toHaveBeenCalledTimes(1);
            const [url, init] = fetchSpy.mock.calls[0] as unknown as [string, RequestInit];
            expect(url).toMatch(/\/task\/$/);
            expect(init).toMatchObject({ method: "PUT", keepalive: true });
            expect(JSON.parse(init.body as string)).toEqual({
                task_id: 1,
                status: "Deleted",
                status_code: 0,
            });

            act(() =>
                view.result.current.deleteTask({
                    id: 2,
                    projectId: 10,
                    isMilestone: true,
                    milestoneId: 5,
                })
            );
            act(() => flushUndoables("exit"));
            expect(fetchSpy).toHaveBeenCalledTimes(2);
            const [murl, minit] = fetchSpy.mock.calls[1] as unknown as [string, RequestInit];
            expect(murl).toMatch(/\/milestone\/5\/$/);
            expect(minit).toMatchObject({ method: "PATCH", keepalive: true });
            expect(JSON.parse(minit.body as string)).toEqual({ status: "Deleted" });
        } finally {
            vi.unstubAllGlobals();
        }
    });
});
