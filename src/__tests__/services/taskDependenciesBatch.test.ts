import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadTaskDependenciesForTasks } from "../../features/tasks/services/loadTaskDependencies";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
}));

const mockAuthApi = vi.mocked(authApi);

const ref = (otherTaskId: number) => ({
    dependencyId: otherTaskId * 10,
    otherTaskId,
    displayId: `GEN-${otherTaskId}`,
    projectId: 1,
    projectName: "Genos",
    title: `Task ${otherTaskId}`,
    status: { code: 0, status: "Open", color: null, textColor: null },
    assigneeUserId: null,
    isMilestone: false,
});

describe("loadTaskDependenciesForTasks", () => {
    beforeEach(() => {
        mockAuthApi.mockReset();
    });

    it("resolves the whole set in one request and fills missing ids with empty lists", async () => {
        const get = vi.fn().mockResolvedValue({
            data: {
                dependencies_by_task: {
                    "1": { blocking: [ref(2)], blockedBy: [] },
                    "2": { blocking: [], blockedBy: [ref(1)] },
                    // id 3 intentionally absent from the response
                },
            },
        });
        mockAuthApi.mockReturnValue({ get } as never);

        const out = await loadTaskDependenciesForTasks([1, 2, 3, 1], "token");

        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith("/task/dependency/list-for-tasks/?task_ids=1,2,3");
        expect(out?.[1].blocking).toEqual([ref(2)]);
        expect(out?.[2].blockedBy).toEqual([ref(1)]);
        expect(out?.[3]).toEqual({ blocking: [], blockedBy: [] });
    });

    it("falls back to per-task requests when the batch endpoint fails", async () => {
        // Simulates an older backend (404) — every id must still
        // resolve via the single-task endpoint.
        const get = vi
            .fn()
            .mockRejectedValueOnce(Object.assign(new Error("404"), { response: { status: 404 } }))
            .mockResolvedValueOnce({ data: { blocking: [ref(9)], blockedBy: [] } })
            .mockResolvedValueOnce({ data: { blocking: [], blockedBy: [] } });
        mockAuthApi.mockReturnValue({ get } as never);

        const out = await loadTaskDependenciesForTasks([7, 8], "token");

        expect(get).toHaveBeenCalledTimes(3);
        expect(get.mock.calls[1][0]).toBe("/task/dependency/list/?task_id=7");
        expect(get.mock.calls[2][0]).toBe("/task/dependency/list/?task_id=8");
        expect(out?.[7].blocking).toEqual([ref(9)]);
        expect(out?.[8]).toEqual({ blocking: [], blockedBy: [] });
    });

    it("returns an empty record without a request for an empty id list", async () => {
        const get = vi.fn();
        mockAuthApi.mockReturnValue({ get } as never);
        expect(await loadTaskDependenciesForTasks([], "token")).toEqual({});
        expect(get).not.toHaveBeenCalled();
    });

    it("returns undefined when there is no auth token", async () => {
        mockAuthApi.mockReturnValue(null as never);
        expect(await loadTaskDependenciesForTasks([1], null)).toBeUndefined();
    });
});
