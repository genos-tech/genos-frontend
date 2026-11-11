/**
 * MIP-1409. `refreshLinkedPullsBatched` is how the PR column asks again for a row that is
 * already drawn: past the client memo, still one request for the rows that ask together, with
 * the server's cache skipped only when the caller says so, and `null` (not `[]`) on a failure so
 * the caller keeps what it shows.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    _resetLinkedPullsBatchingForTests,
    loadLinkedPullsBatched,
    refreshLinkedPullsBatched,
    type LinkedPull,
} from "../../features/integrations/services/github";
import { authApi } from "../../services/api";

vi.mock("../../services/api", () => ({
    authApi: vi.fn(),
}));

const mockAuthApi = vi.mocked(authApi);

const pull = (number: number, over: Partial<LinkedPull> = {}): LinkedPull => ({
    owner: "acme",
    repo: "rocket",
    branch: `feature/GEN-${number}`,
    number,
    html_url: `https://github.com/acme/rocket/pull/${number}`,
    title: `PR ${number}`,
    state: "open",
    draft: false,
    merged_at: null,
    ...over,
});
const mergedPull = (n: number) => pull(n, { state: "closed", merged_at: "2026-11-11T01:00:00Z" });

const reply = (byTask: Record<string, LinkedPull[]>) => ({ data: { pulls_by_task: byTask } });

beforeEach(() => {
    vi.useFakeTimers();
    _resetLinkedPullsBatchingForTests();
    mockAuthApi.mockReset();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("refreshLinkedPullsBatched", () => {
    it("asks again for a row the memo already holds", async () => {
        const get = vi
            .fn()
            .mockResolvedValueOnce(reply({ "1": [pull(7)] }))
            .mockResolvedValueOnce(reply({ "1": [mergedPull(7)] }));
        mockAuthApi.mockReturnValue({ get } as never);

        const first = loadLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        expect(await first).toEqual([pull(7)]);

        // The same call again is the memo's...
        expect(await loadLinkedPullsBatched("token", 1)).toEqual([pull(7)]);
        expect(get).toHaveBeenCalledTimes(1);

        // ...a refresh is not.
        const again = refreshLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        expect(await again).toEqual([mergedPull(7)]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("stores what it found, so a row that mounts right after reads the new answer", async () => {
        const get = vi
            .fn()
            .mockResolvedValueOnce(reply({ "1": [pull(7)] }))
            .mockResolvedValueOnce(reply({ "1": [mergedPull(7)] }));
        mockAuthApi.mockReturnValue({ get } as never);
        const first = loadLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        await first;

        const refreshed = refreshLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        await refreshed;

        expect(await loadLinkedPullsBatched("token", 1)).toEqual([mergedPull(7)]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("rows that ask in the same window share one request", async () => {
        const get = vi.fn().mockResolvedValue(reply({ "1": [pull(7)], "2": [pull(8)] }));
        mockAuthApi.mockReturnValue({ get } as never);

        const a = refreshLinkedPullsBatched("token", 1);
        const b = refreshLinkedPullsBatched("token", 2);
        const c = refreshLinkedPullsBatched("token", 3);
        await vi.advanceTimersByTimeAsync(60);

        expect(await a).toEqual([pull(7)]);
        expect(await b).toEqual([pull(8)]);
        expect(await c).toEqual([]);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("sends no `fresh` unless asked: the request is exactly the one a first load sends", async () => {
        const get = vi.fn().mockResolvedValue(reply({ "1": [pull(7)] }));
        mockAuthApi.mockReturnValue({ get } as never);

        const a = refreshLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        await a;

        expect(get).toHaveBeenCalledWith("/github/pulls/for-tasks/", {
            params: { task_ids: "1" },
            suppressErrorToast: true,
        });
    });

    it("`fresh: true` sends fresh=1 so the server skips its own cache", async () => {
        const get = vi.fn().mockResolvedValue(reply({ "1": [pull(7)] }));
        mockAuthApi.mockReturnValue({ get } as never);

        const a = refreshLinkedPullsBatched("token", 1, { fresh: true });
        await vi.advanceTimersByTimeAsync(60);
        await a;

        expect(get).toHaveBeenCalledWith("/github/pulls/for-tasks/", {
            params: { task_ids: "1", fresh: "1" },
            suppressErrorToast: true,
        });
    });

    it("one row asking for a fresh answer makes the shared request a fresh one", async () => {
        const get = vi.fn().mockResolvedValue(reply({ "1": [pull(7)], "2": [pull(8)] }));
        mockAuthApi.mockReturnValue({ get } as never);

        const a = refreshLinkedPullsBatched("token", 1);
        const b = refreshLinkedPullsBatched("token", 2, { fresh: true });
        await vi.advanceTimersByTimeAsync(60);
        await Promise.all([a, b]);

        expect(get).toHaveBeenCalledTimes(1);
        expect(get.mock.calls[0][1].params).toEqual({ task_ids: "1,2", fresh: "1" });
    });

    it("resolves null on a failed request, and does NOT fall back to one request per row", async () => {
        const get = vi.fn().mockRejectedValue(new Error("502"));
        mockAuthApi.mockReturnValue({ get } as never);

        const a = refreshLinkedPullsBatched("token", 1);
        const b = refreshLinkedPullsBatched("token", 2);
        const c = refreshLinkedPullsBatched("token", 3);
        await vi.advanceTimersByTimeAsync(60);

        expect(await Promise.all([a, b, c])).toEqual([null, null, null]);
        // The mount path would have sent 1 + 3 requests here.
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("a failure is not stored: the memo keeps the last good answer", async () => {
        const get = vi
            .fn()
            .mockResolvedValueOnce(reply({ "1": [pull(7)] }))
            .mockRejectedValueOnce(new Error("502"));
        mockAuthApi.mockReturnValue({ get } as never);
        const first = loadLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        await first;

        const failed = refreshLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        expect(await failed).toBeNull();

        // Still the first answer, from the memo, with no third request.
        expect(await loadLinkedPullsBatched("token", 1)).toEqual([pull(7)]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("resolves null with no auth token", async () => {
        mockAuthApi.mockReturnValue(null as never);
        const a = refreshLinkedPullsBatched(null, 1);
        await vi.advanceTimersByTimeAsync(60);
        expect(await a).toBeNull();
    });

    it("the first load still falls back per task when the batch fails (deploy order stays safe)", async () => {
        const get = vi
            .fn()
            .mockRejectedValueOnce(new Error("404"))
            .mockResolvedValueOnce({ data: { pulls: [pull(7)] } });
        mockAuthApi.mockReturnValue({ get } as never);

        const a = loadLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);

        expect(await a).toEqual([pull(7)]);
        expect(get.mock.calls[1][0]).toBe("/github/pulls/for-task/");
    });
});
