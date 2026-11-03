/**
 * The task's branch and PR lookups share a short client memo (MIP-967).
 *
 * Both fire on every task open and again on every window focus, and each one
 * makes the server ask GitHub (about a second, sometimes six). The answer
 * almost never changes between those moments, so a repeat within the TTL
 * sends nothing; the refresh icon (`bypassCache`) still asks for a fresh one.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    loadLinkedBranches,
    loadLinkedPulls,
    resetLinkedGithubMemo,
    tryLoadLinkedBranches,
    tryLoadLinkedPulls,
} from "../features/integrations/services/github";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
}));

const mockAuthApi = vi.mocked(authApi);

const branch = (name: string) => ({
    owner: "acme",
    repo: "rocket",
    name,
    url: `https://github.com/acme/rocket/tree/${name}`,
});
const pull = (number: number) => ({
    owner: "acme",
    repo: "rocket",
    branch: `GEN-42-${number}`,
    number,
    html_url: `https://github.com/acme/rocket/pull/${number}`,
    title: `PR ${number}`,
    state: "open" as const,
    draft: false,
    merged_at: null,
});

type Case = {
    name: string;
    url: string;
    key: "branches" | "pulls";
    item: (n: number) => unknown;
    tryLoad: (
        token: string | null,
        taskId: number | string,
        o?: { bypassCache?: boolean }
    ) => Promise<unknown[] | null>;
    load: (
        token: string | null,
        taskId: number | string,
        o?: { bypassCache?: boolean }
    ) => Promise<unknown[]>;
};

const cases: Case[] = [
    {
        name: "branches",
        url: "/github/branches/for-task/",
        key: "branches",
        item: (n) => branch(`GEN-42-${n}`),
        tryLoad: tryLoadLinkedBranches,
        load: loadLinkedBranches,
    },
    {
        name: "pulls",
        url: "/github/pulls/for-task/",
        key: "pulls",
        item: pull,
        tryLoad: tryLoadLinkedPulls,
        load: loadLinkedPulls,
    },
];

describe.each(cases)("linked $name lookup", (c) => {
    const get = vi.fn();
    const answer = (n: number) => ({ data: { [c.key]: [c.item(n)] } });

    beforeEach(() => {
        resetLinkedGithubMemo();
        get.mockReset();
        mockAuthApi.mockReset();
        mockAuthApi.mockReturnValue({ get } as never);
    });
    afterEach(() => {
        vi.useRealTimers();
    });

    it("asks the server once and answers a repeat from memory", async () => {
        get.mockResolvedValue(answer(1));

        const first = await c.tryLoad("tok", 42);
        const again = await c.tryLoad("tok", 42);

        expect(get).toHaveBeenCalledTimes(1);
        expect(get.mock.calls[0][0]).toBe(c.url);
        expect(again).toEqual(first);
        expect(first).toEqual([c.item(1)]);
    });

    it("shares one request between concurrent callers", async () => {
        get.mockResolvedValue(answer(1));
        await Promise.all([c.tryLoad("tok", 42), c.tryLoad("tok", 42), c.tryLoad("tok", 42)]);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("keeps one memo entry per task", async () => {
        get.mockResolvedValue(answer(1));
        await c.tryLoad("tok", 42);
        await c.tryLoad("tok", 43);
        expect(get).toHaveBeenCalledTimes(2);
        expect(get.mock.calls.map((call) => call[1].params.task_id)).toEqual([42, 43]);
    });

    it("never hands one sign-in's answer to another", async () => {
        get.mockResolvedValue(answer(1));
        await c.tryLoad("tok-user-a", 42);
        await c.tryLoad("tok-user-b", 42);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("asks again once the memo is older than two minutes", async () => {
        vi.useFakeTimers();
        get.mockResolvedValue(answer(1));

        await c.tryLoad("tok", 42);
        vi.advanceTimersByTime(119_000);
        await c.tryLoad("tok", 42);
        expect(get).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(2_000);
        await c.tryLoad("tok", 42);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("does not memoize a failure: null now, a real answer on the next call", async () => {
        get.mockRejectedValueOnce(new Error("502")).mockResolvedValue(answer(1));

        expect(await c.tryLoad("tok", 42)).toBeNull();
        expect(await c.tryLoad("tok", 42)).toEqual([c.item(1)]);
        expect(get).toHaveBeenCalledTimes(2);
        // ...and now it is memoized.
        await c.tryLoad("tok", 42);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("keeps the old plain-list contract: [] on a failure or without a token", async () => {
        get.mockRejectedValue(new Error("502"));
        expect(await c.load("tok", 42)).toEqual([]);

        mockAuthApi.mockReturnValue(null as never);
        expect(await c.load(null, 42)).toEqual([]);
        expect(await c.tryLoad(null, 42)).toBeNull();
    });

    it("bypassCache asks again with fresh=1 and refreshes what later calls see", async () => {
        get.mockResolvedValueOnce(answer(1)).mockResolvedValueOnce(answer(2));

        await c.tryLoad("tok", 42);
        const refreshed = await c.tryLoad("tok", 42, { bypassCache: true });

        expect(get).toHaveBeenCalledTimes(2);
        expect(get.mock.calls[1][1].params).toMatchObject({ task_id: 42, fresh: "1" });
        expect(get.mock.calls[0][1].params).not.toHaveProperty("fresh");
        expect(refreshed).toEqual([c.item(2)]);

        // A plain call afterwards (a window focus) sees the refreshed answer
        // without another request.
        expect(await c.tryLoad("tok", 42)).toEqual([c.item(2)]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("a failed refresh leaves the previous answer in the memo", async () => {
        get.mockResolvedValueOnce(answer(1)).mockRejectedValueOnce(new Error("502"));

        await c.tryLoad("tok", 42);
        expect(await c.tryLoad("tok", 42, { bypassCache: true })).toBeNull();

        expect(await c.tryLoad("tok", 42)).toEqual([c.item(1)]);
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("an empty answer is memoized too", async () => {
        get.mockResolvedValue({ data: { [c.key]: [] } });
        expect(await c.tryLoad("tok", 42)).toEqual([]);
        expect(await c.tryLoad("tok", 42)).toEqual([]);
        expect(get).toHaveBeenCalledTimes(1);
    });
});
