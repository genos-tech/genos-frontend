/**
 * `loadTaskDependenciesFor(taskId, land?)` on the task manager (MIP-968).
 *
 * A task preview hands it a `land` so the dependency edges are written
 * together with the open's other loaders (see taskOpenLanding.ts). Callers
 * that pass nothing (adding/removing a dependency) keep writing at once. The
 * write is handed over even when the request failed, so a waiting batch is
 * not kept for a loader that has nothing to write.
 */
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { useTaskManagement } from "../../hooks/tasks/useTaskManagement";
import { UserProps } from "../../types/admin";

vi.mock("../../features/tasks/services/loadSpecificTask", () => ({
    loadSpecificTask: vi.fn(async () => []),
}));

const api = vi.hoisted(() => ({
    get: vi.fn(async (): Promise<unknown> => ({ data: {} })),
}));
vi.mock("../../services/api", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../../services/api")>()),
    authApi: () => ({ get: api.get }),
}));

const myself = {
    userId: "u1",
    teamId: "t1",
    userName: "Me",
    userEmail: "me@example.com",
} as UserProps;

const EDGES = { blocking: [{ id: 1 }], blockedBy: [{ id: 2 }, { id: 3 }] };

beforeEach(() => {
    api.get.mockImplementation(async () => ({ data: EDGES }));
    vi.spyOn(console, "error").mockImplementation(() => undefined);
});
afterEach(() => {
    vi.restoreAllMocks();
    api.get.mockReset();
});

describe("loadTaskDependenciesFor", () => {
    it("without a landing it writes the edges as soon as they arrive", async () => {
        const { result } = renderHook(() => useTaskManagement(myself, "token"));
        await act(async () => {
            await result.current.loadTaskDependenciesFor(5);
        });
        expect(api.get).toHaveBeenCalledWith("/task/dependency/list/?task_id=5");
        expect(result.current.taskDependencies[5]).toEqual(EDGES);
    });

    it("with a landing the write is handed over, and runs only when the landing runs it", async () => {
        const { result } = renderHook(() => useTaskManagement(myself, "token"));
        const handed: Array<() => void> = [];
        await act(async () => {
            await result.current.loadTaskDependenciesFor(5, (write) => handed.push(write));
        });
        expect(handed).toHaveLength(1);
        expect(result.current.taskDependencies[5]).toBeUndefined();

        act(() => handed[0]());
        expect(result.current.taskDependencies[5]).toEqual(EDGES);
    });

    it("a failed request still hands over a write (so a batch is not kept waiting), and it writes nothing", async () => {
        api.get.mockRejectedValue(new Error("boom"));
        const { result } = renderHook(() => useTaskManagement(myself, "token"));
        const handed: Array<() => void> = [];
        await act(async () => {
            await result.current.loadTaskDependenciesFor(5, (write) => handed.push(write));
        });
        expect(handed).toHaveLength(1);
        act(() => handed[0]());
        expect(result.current.taskDependencies[5]).toBeUndefined();
    });
});
