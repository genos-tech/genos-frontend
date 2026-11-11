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
        expect(await again).toEqual({ pulls: [mergedPull(7)], complete: false });
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

        expect(await a).toEqual({ pulls: [pull(7)], complete: false });
        expect(await b).toEqual({ pulls: [pull(8)], complete: false });
        expect(await c).toEqual({ pulls: [], complete: false });
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

describe("the server says which rows it could not fully look at (MIP-1412)", () => {
    const reportsAs = (
        byTask: Record<string, LinkedPull[]>,
        incomplete: string[] | undefined
    ) => ({
        data:
            incomplete === undefined
                ? { pulls_by_task: byTask }
                : { pulls_by_task: byTask, incomplete },
    });

    it("a server that reports, and does not name the row, vouches for its list: complete", async () => {
        const get = vi.fn().mockResolvedValue(reportsAs({ "1": [pull(7)], "2": [] }, []));
        mockAuthApi.mockReturnValue({ get } as never);

        const a = refreshLinkedPullsBatched("token", 1);
        const b = refreshLinkedPullsBatched("token", 2);
        await vi.advanceTimersByTimeAsync(60);

        expect(await a).toEqual({ pulls: [pull(7)], complete: true });
        // An empty list the server vouches for is "no PR".
        expect(await b).toEqual({ pulls: [], complete: true });
    });

    it("a server that does not report cannot vouch for anything: not complete", async () => {
        const get = vi.fn().mockResolvedValue(reportsAs({ "1": [] }, undefined));
        mockAuthApi.mockReturnValue({ get } as never);

        const a = refreshLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);

        expect(await a).toEqual({ pulls: [], complete: false });
    });

    it("a row it names is a failed re-sync (null), and the rows it does not name are fine", async () => {
        const get = vi.fn().mockResolvedValue(reportsAs({ "1": [], "2": [pull(8)] }, ["1"]));
        mockAuthApi.mockReturnValue({ get } as never);

        const a = refreshLinkedPullsBatched("token", 1);
        const b = refreshLinkedPullsBatched("token", 2);
        await vi.advanceTimersByTimeAsync(60);

        expect(await a).toBeNull();
        expect(await b).toEqual({ pulls: [pull(8)], complete: true });
    });

    it("a refresh of a row it names stores nothing: the last good answer is still the memo's", async () => {
        const get = vi
            .fn()
            .mockResolvedValueOnce(reportsAs({ "1": [pull(7)] }, []))
            .mockResolvedValueOnce(reportsAs({ "1": [] }, ["1"]));
        mockAuthApi.mockReturnValue({ get } as never);
        const first = loadLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        await first;

        const partial = refreshLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        expect(await partial).toBeNull();

        expect(await loadLinkedPullsBatched("token", 1)).toEqual([pull(7)]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("a first load of a row it names is drawn as answered, but not kept for the memo's minute", async () => {
        const get = vi
            .fn()
            .mockResolvedValueOnce(reportsAs({ "1": [] }, ["1"]))
            .mockResolvedValueOnce(reportsAs({ "1": [pull(7)] }, []));
        mockAuthApi.mockReturnValue({ get } as never);

        const first = loadLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        expect(await first).toEqual([]);

        // The next mount asks again, and now gets the PR.
        const second = loadLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        expect(await second).toEqual([pull(7)]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("a first load of a row it does NOT name is kept as before", async () => {
        const get = vi.fn().mockResolvedValue(reportsAs({ "1": [pull(7)] }, []));
        mockAuthApi.mockReturnValue({ get } as never);

        const first = loadLinkedPullsBatched("token", 1);
        await vi.advanceTimersByTimeAsync(60);
        await first;

        expect(await loadLinkedPullsBatched("token", 1)).toEqual([pull(7)]);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("dropping one task's memo entry leaves another whose id starts the same", async () => {
        // `invalidate` matches by prefix: task 12 must not take task 120 with it.
        const get = vi
            .fn()
            .mockResolvedValueOnce(reportsAs({ "120": [pull(7)] }, []))
            .mockResolvedValueOnce(reportsAs({ "12": [] }, ["12"]));
        mockAuthApi.mockReturnValue({ get } as never);
        const big = loadLinkedPullsBatched("token", 120);
        await vi.advanceTimersByTimeAsync(60);
        await big;

        const small = loadLinkedPullsBatched("token", 12);
        await vi.advanceTimersByTimeAsync(60);
        await small;

        expect(await loadLinkedPullsBatched("token", 120)).toEqual([pull(7)]);
        expect(get).toHaveBeenCalledTimes(2);
    });
});
