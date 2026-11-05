/**
 * Finding one task by its exact display id for the `#` menus, the task search
 * box and the Genos mention menu (MIP-739). The id may be one that doesn't
 * exist (a typo, `#kds-652`), and the callers ask again on every keystroke or
 * re-render, so the lookup must not turn each ask into a request (MIP-1038):
 * concurrent asks share one request, and a "no such task" answer is remembered
 * for a short while. A task created a moment later is still found, because the
 * memory expires; a network error is not "no such task" and is never kept.
 */
import axios, { AxiosError, type InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    clearTaskLookupCache,
    lookupTaskByDisplayId,
} from "../features/tasks/services/lookupTaskByDisplayId";

const adapter = vi.fn();
let originalAdapter: typeof axios.defaults.adapter;
let now = 1_000_000;

const found = (taskId: number) => ({ taskId, displayId: "KDS-1", title: "T" });
const reply = (status: number, data: unknown = {}) =>
    adapter.mockImplementation(async (config: InternalAxiosRequestConfig) => {
        if (status < 400) return { data, status, statusText: "OK", headers: {}, config };
        throw new AxiosError(`status ${status}`, "ERR_BAD_REQUEST", config, null, {
            data,
            status,
            statusText: "",
            headers: {},
            config,
        });
    });

const me = { teamId: "t1" };
const ask = (id = "kds-652") => lookupTaskByDisplayId(me, id, "tok");

beforeEach(() => {
    originalAdapter = axios.defaults.adapter;
    axios.defaults.adapter = adapter;
    adapter.mockReset();
    clearTaskLookupCache();
    now += 10 * 60_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => {
    axios.defaults.adapter = originalAdapter;
    vi.restoreAllMocks();
});

describe("lookupTaskByDisplayId", () => {
    it("finds a task and keeps it for the session", async () => {
        reply(200, found(7));
        expect((await ask("kds-7"))?.taskId).toBe(7);
        expect((await ask("KDS-7"))?.taskId).toBe(7);
        expect(adapter).toHaveBeenCalledTimes(1);
    });

    it("shares ONE request between concurrent asks for the same id", async () => {
        reply(404);
        const results = await Promise.all([ask(), ask(), ask(), ask("KDS-652")]);
        expect(results).toEqual([null, null, null, null]);
        expect(adapter).toHaveBeenCalledTimes(1);
    });

    it("does not ask again for 30 seconds after a 404", async () => {
        reply(404);
        expect(await ask()).toBeNull();
        now += 29_000;
        expect(await ask()).toBeNull();
        expect(adapter).toHaveBeenCalledTimes(1);
    });

    it("asks again once the 30 seconds are over, and finds a task created meanwhile", async () => {
        reply(404);
        expect(await ask()).toBeNull();
        now += 30_001;
        reply(200, found(652));

        expect((await ask())?.taskId).toBe(652);
        expect(adapter).toHaveBeenCalledTimes(2);
    });

    it("keeps the miss memory per id and per team", async () => {
        reply(404);
        await ask("kds-652");
        await ask("kds-653");
        await lookupTaskByDisplayId({ teamId: "t2" }, "kds-652", "tok");
        expect(adapter).toHaveBeenCalledTimes(3);
    });

    it("does not remember a network error as 'no such task'", async () => {
        adapter.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
        expect(await ask()).toBeNull();

        reply(200, found(652));
        expect((await ask())?.taskId).toBe(652);
        expect(adapter).toHaveBeenCalledTimes(2);
    });

    it("does not remember a server error either", async () => {
        reply(500);
        expect(await ask()).toBeNull();
        reply(200, found(652));
        expect((await ask())?.taskId).toBe(652);
    });

    it("lets a failed in-flight request go, so the next ask retries", async () => {
        adapter.mockRejectedValueOnce(new AxiosError("Network Error", "ERR_NETWORK"));
        await Promise.all([ask(), ask()]);
        reply(200, found(652));
        expect((await ask())?.taskId).toBe(652);
    });

    it("asks nothing without a team or a token", async () => {
        expect(await lookupTaskByDisplayId({ teamId: "" }, "kds-1", "tok")).toBeNull();
        expect(await lookupTaskByDisplayId(me, "kds-1", null)).toBeNull();
        expect(adapter).not.toHaveBeenCalled();
    });
});
