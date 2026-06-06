import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadSpecificTask } from "../../features/tasks/services/loadSpecificTask";
import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskProps } from "../../types/tasks";

// Control the IDB/network loader so we can land loads out of order and
// prove the IDENTITY guard (write the preview only with the currently
// selected task). The id is the 3rd argument to loadSpecificTask.
vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(),
}));

const loadSpecificTaskMock = loadSpecificTask as unknown as ReturnType<typeof vi.fn>;

const myself = {
    userId: "u1",
    teamId: "t1",
    userName: "Me",
    userEmail: "me@example.com",
} as UserProps;

const mkTask = (id: number): TaskProps => ({ id, title: `Task ${id}` }) as TaskProps;

function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

const flush = () =>
    act(async () => {
        await Promise.resolve();
        await Promise.resolve();
    });

afterEach(() => {
    vi.clearAllMocks();
});

describe("useTaskManagement — preview identity guard (rapid switch + stick)", () => {
    it("a load resolving after the selection moved on is NOT written (rapid switch)", async () => {
        const dA = deferred<TaskProps[]>();
        const dC = deferred<TaskProps[]>();
        loadSpecificTaskMock.mockImplementation((_m: unknown, _p: unknown, taskId: number) =>
            taskId === 1 ? dA.promise : dC.promise
        );
        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        // Select + load A.
        act(() => result.current.setCurrentPreviewTaskId(1));
        act(() => void result.current.loadTask(10, 1));
        // User rapidly switches to C (the final selection).
        act(() => result.current.setCurrentPreviewTaskId(3));
        act(() => void result.current.loadTask(10, 3));

        // C resolves first and is written — it's the current selection.
        dC.resolve([mkTask(3)]);
        await flush();
        expect(result.current.currentPreviewTask?.id).toBe(3);

        // A resolves LATE — the identity guard must reject it (1 !== 3).
        dA.resolve([mkTask(1)]);
        await flush();
        expect(result.current.currentPreviewTask?.id).toBe(3);
    });

    it("a stale-closure loadUpdatedTask resolving LAST does not win (the prod bug)", async () => {
        const dStale = deferred<TaskProps[]>();
        const dC = deferred<TaskProps[]>();
        loadSpecificTaskMock.mockImplementation((_m: unknown, _p: unknown, taskId: number) =>
            taskId === 1 ? dStale.promise : dC.promise
        );
        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        // Previewing A; a loadUpdatedTask fires for A (reads currentPreviewTaskId=1).
        act(() => result.current.setCurrentPreviewTaskId(1));
        act(() => void result.current.loadUpdatedTask(10));

        // User switches to C; it loads and writes.
        act(() => result.current.setCurrentPreviewTaskId(3));
        act(() => void result.current.loadTask(10, 3));
        dC.resolve([mkTask(3)]);
        await flush();
        expect(result.current.currentPreviewTask?.id).toBe(3);

        // The stale loadUpdatedTask (for A) resolves LAST. Under the old
        // epoch-only guard it would win (highest epoch) and show task 1;
        // the identity guard rejects it.
        dStale.resolve([mkTask(1)]);
        await flush();
        expect(result.current.currentPreviewTask?.id).toBe(3);
    });

    it("a same-id refresh resolving empty does not orphan the switch write (no stick)", async () => {
        const dLoad = deferred<TaskProps[]>();
        const dRefresh = deferred<TaskProps[]>();
        let call = 0;
        loadSpecificTaskMock.mockImplementation(() => {
            // Both target task 2: first call = loadTask, second = loadUpdatedTask.
            call += 1;
            return call === 1 ? dLoad.promise : dRefresh.promise;
        });
        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        act(() => result.current.setCurrentPreviewTaskId(2));
        act(() => void result.current.loadTask(10, 2));
        act(() => void result.current.loadUpdatedTask(10));

        // The refresh resolves empty FIRST. Under the old shared-epoch guard
        // it consumed the latest epoch and the switch's loadTask write was
        // then dropped → preview stuck on the previous task.
        dRefresh.resolve([]);
        await flush();
        // loadTask resolves with task 2 — identity matches the selection, so
        // it must land regardless of the refresh's ordering.
        dLoad.resolve([mkTask(2)]);
        await flush();
        expect(result.current.currentPreviewTask?.id).toBe(2);
    });

    it("a single load still populates the preview (no false-positive guard)", async () => {
        loadSpecificTaskMock.mockResolvedValue([mkTask(7)]);
        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        act(() => result.current.setCurrentPreviewTaskId(7));
        await act(async () => {
            await result.current.loadTask(10, 7);
        });

        expect(result.current.currentPreviewTask?.id).toBe(7);
    });
});
