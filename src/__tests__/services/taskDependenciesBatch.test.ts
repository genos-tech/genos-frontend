import { beforeEach, describe, expect, it, vi } from "vitest";

import {
    BATCH_CONCURRENCY,
    BATCH_RETRY_DELAY_MS,
    loadTaskDependenciesBatched,
    loadTaskDependenciesForTasks,
} from "../../features/tasks/services/loadTaskDependencies";
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

    // MIP-1416: a failed batch used to fan out into one GET per task. On a 429
    // from the read throttle that turned one refused request into hundreds more,
    // against the same throttle. Now it is retried once, then reported.
    it("retries a failed batch once and never falls back to one request per task", async () => {
        const get = vi
            .fn()
            .mockRejectedValueOnce(Object.assign(new Error("500"), { response: { status: 500 } }))
            .mockResolvedValueOnce({
                data: { dependencies_by_task: { "7": { blocking: [ref(9)], blockedBy: [] } } },
            });
        mockAuthApi.mockReturnValue({ get } as never);
        const sleep = vi.fn().mockResolvedValue(undefined);

        const out = await loadTaskDependenciesBatched([7, 8], "token", { sleep });

        expect(get).toHaveBeenCalledTimes(2);
        for (const [url] of get.mock.calls) {
            expect(url).toBe("/task/dependency/list-for-tasks/?task_ids=7,8");
        }
        expect(sleep).toHaveBeenCalledWith(BATCH_RETRY_DELAY_MS);
        expect(out?.failedIds).toEqual([]);
        expect(out?.byTask[7].blocking).toEqual([ref(9)]);
        expect(out?.byTask[8]).toEqual({ blocking: [], blockedBy: [] });
    });

    it("waits as long as a 429 asks, within a ceiling", async () => {
        const tooMany = (seconds: string) =>
            Object.assign(new Error("429"), {
                isAxiosError: true,
                response: { status: 429, headers: { "retry-after": seconds } },
            });
        const ok = { data: { dependencies_by_task: {} } };
        for (const [header, waited] of [
            ["2", 2000],
            ["60", 5000],
        ] as const) {
            const get = vi.fn().mockRejectedValueOnce(tooMany(header)).mockResolvedValueOnce(ok);
            mockAuthApi.mockReturnValue({ get } as never);
            const sleep = vi.fn().mockResolvedValue(undefined);
            await loadTaskDependenciesBatched([1], "token", { sleep });
            expect(sleep).toHaveBeenCalledWith(waited);
        }
    });

    it("a batch that fails twice is reported, with no entries that would erase real edges", async () => {
        const fail = Object.assign(new Error("429"), { response: { status: 429 } });
        const get = vi.fn().mockRejectedValue(fail);
        mockAuthApi.mockReturnValue({ get } as never);
        const sleep = vi.fn().mockResolvedValue(undefined);

        const out = await loadTaskDependenciesBatched([7, 8], "token", { sleep });

        expect(get).toHaveBeenCalledTimes(2);
        expect(out?.failedIds.sort()).toEqual([7, 8]);
        expect(out?.byTask).toEqual({});
        // The plain-map wrapper (the task manager merges it into its store)
        // leaves the failed ids out, so the store keeps what it had for them.
        get.mockClear();
        expect(await loadTaskDependenciesForTasks([7, 8], "token", { sleep })).toEqual({});
        expect(get.mock.calls.every(([url]) => !String(url).includes("/dependency/list/?"))).toBe(
            true
        );
    });

    it("runs the batches in parallel, at most BATCH_CONCURRENCY at a time", async () => {
        const ids = Array.from({ length: 1600 }, (_, i) => i + 1); // four batches of ≤500
        let inFlight = 0;
        let peak = 0;
        const get = vi.fn().mockImplementation(async () => {
            inFlight += 1;
            peak = Math.max(peak, inFlight);
            await new Promise((resolve) => setTimeout(resolve, 5));
            inFlight -= 1;
            return { data: { dependencies_by_task: {} } };
        });
        mockAuthApi.mockReturnValue({ get } as never);

        const out = await loadTaskDependenciesBatched(ids, "token");

        expect(get).toHaveBeenCalledTimes(4);
        expect(peak).toBe(BATCH_CONCURRENCY);
        expect(Object.keys(out?.byTask ?? {})).toHaveLength(1600);
        expect(out?.failedIds).toEqual([]);
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
