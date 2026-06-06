import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { loadSpecificTask } from "../../features/tasks/services/loadSpecificTask";
import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";
import { TaskProps } from "../../types/tasks";

// The preview-load path is the only thing under test; stub the IDB/network
// loader so we can control resolution ORDER and prove the epoch guard.
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

// A promise whose resolution we trigger by hand, so the test can land
// loads out of request order (the rapid-switch race).
function deferred<T>() {
    let resolve!: (value: T) => void;
    const promise = new Promise<T>((r) => {
        resolve = r;
    });
    return { promise, resolve };
}

const flush = () => act(async () => {
    await Promise.resolve();
    await Promise.resolve();
});

afterEach(() => {
    vi.clearAllMocks();
});

describe("useTaskManagement — preview-load epoch guard (rapid-switch race)", () => {
    it("a stale, slower load does NOT clobber the newer selection", async () => {
        const d1 = deferred<TaskProps[]>();
        const d2 = deferred<TaskProps[]>();
        loadSpecificTaskMock.mockImplementation((_m: unknown, _p: unknown, taskId: number) =>
            taskId === 1 ? d1.promise : d2.promise
        );

        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        // User clicks task 1, then quickly task 2 (the final selection).
        act(() => {
            void result.current.loadTask(10, 1);
        });
        act(() => {
            void result.current.loadTask(10, 2);
        });

        // The NEWER load (task 2) resolves first → it owns the preview.
        d2.resolve([mkTask(2)]);
        await flush();
        expect(result.current.currentPreviewTask?.id).toBe(2);

        // The OLDER load (task 1) resolves LATE. Without the epoch guard it
        // would overwrite the preview with the stale task 1 — the exact
        // "rapid switching lands on the wrong task" bug.
        d1.resolve([mkTask(1)]);
        await flush();
        expect(result.current.currentPreviewTask?.id).toBe(2);
    });

    it("the latest load always wins regardless of resolution order", async () => {
        const deferreds = new Map<number, ReturnType<typeof deferred<TaskProps[]>>>();
        loadSpecificTaskMock.mockImplementation((_m: unknown, _p: unknown, taskId: number) => {
            const d = deferred<TaskProps[]>();
            deferreds.set(taskId, d);
            return d.promise;
        });

        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        // Three rapid clicks: 1 → 2 → 3. 3 is the final selection.
        act(() => void result.current.loadTask(10, 1));
        act(() => void result.current.loadTask(10, 2));
        act(() => void result.current.loadTask(10, 3));

        // Resolve in a deliberately scrambled order: 3, then 1, then 2.
        deferreds.get(3)!.resolve([mkTask(3)]);
        await flush();
        deferreds.get(1)!.resolve([mkTask(1)]);
        await flush();
        deferreds.get(2)!.resolve([mkTask(2)]);
        await flush();

        // Only the latest-started load (task 3) may write the preview.
        expect(result.current.currentPreviewTask?.id).toBe(3);
    });

    it("a single load still populates the preview (no false-positive guard)", async () => {
        loadSpecificTaskMock.mockResolvedValue([mkTask(7)]);

        const { result } = renderHook(() => useTaskManagement(myself, "token"));

        await act(async () => {
            await result.current.loadTask(10, 7);
        });

        expect(result.current.currentPreviewTask?.id).toBe(7);
    });
});
