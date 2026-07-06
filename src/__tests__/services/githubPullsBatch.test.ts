import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    _resetLinkedPullsBatchingForTests,
    loadLinkedPullsBatched,
    type LinkedPull,
} from "../../features/integrations/services/github";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
}));

const mockAuthApi = vi.mocked(authApi);

const pull = (number: number): LinkedPull => ({
    owner: "acme",
    repo: "rocket",
    branch: `feature/GEN-${number}`,
    number,
    html_url: `https://github.com/acme/rocket/pull/${number}`,
    title: `PR ${number}`,
    state: "open",
    draft: false,
    merged_at: null,
});

describe("loadLinkedPullsBatched", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        _resetLinkedPullsBatchingForTests();
        mockAuthApi.mockReset();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("coalesces calls within the flush window into one batch request", async () => {
        const get = vi.fn().mockResolvedValue({
            data: { pulls_by_task: { "1": [pull(7)], "2": [pull(8)] } },
        });
        mockAuthApi.mockReturnValue({ get } as never);

        const a = loadLinkedPullsBatched("token", 1);
        const b = loadLinkedPullsBatched("token", 2);
        const c = loadLinkedPullsBatched("token", 3); // no key in response → []
        await vi.advanceTimersByTimeAsync(60);

        expect(await a).toEqual([pull(7)]);
        expect(await b).toEqual([pull(8)]);
        expect(await c).toEqual([]);
        expect(get).toHaveBeenCalledTimes(1);
        expect(get).toHaveBeenCalledWith("/github/pulls/for-tasks/", {
            params: { task_ids: "1,2,3" },
        });
    });

    it("serves repeat calls for the same task from the 60s memo", async () => {
        const get = vi.fn().mockResolvedValue({
            data: { pulls_by_task: { "1": [pull(7)] } },
        });
        mockAuthApi.mockReturnValue({ get } as never);

        const first = loadLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        expect(await first).toEqual([pull(7)]);

        expect(await loadLinkedPullsBatched("token", 1)).toEqual([pull(7)]);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("falls back to the per-task endpoint when the batch request fails", async () => {
        // Simulates a backend without /pulls/for-tasks/ deployed yet
        // (404) — every waiter must still resolve via the single-task
        // endpoint rather than rejecting or hanging.
        const get = vi
            .fn()
            .mockRejectedValueOnce(Object.assign(new Error("404"), { response: { status: 404 } }))
            .mockResolvedValueOnce({ data: { pulls: [pull(7)] } })
            .mockResolvedValueOnce({ data: { pulls: [] } });
        mockAuthApi.mockReturnValue({ get } as never);

        const a = loadLinkedPullsBatched("token", 1);
        const b = loadLinkedPullsBatched("token", 2);
        await vi.advanceTimersByTimeAsync(60);

        expect(await a).toEqual([pull(7)]);
        expect(await b).toEqual([]);
        // 1 failed batch call + 2 per-task fallbacks.
        expect(get).toHaveBeenCalledTimes(3);
        expect(get.mock.calls[1][0]).toBe("/github/pulls/for-task/");
        expect(get.mock.calls[2][0]).toBe("/github/pulls/for-task/");
    });

    it("resolves with an empty list when there is no auth token", async () => {
        mockAuthApi.mockReturnValue(null as never);
        const a = loadLinkedPullsBatched(null, 1);
        await vi.advanceTimersByTimeAsync(60);
        expect(await a).toEqual([]);
    });
});
