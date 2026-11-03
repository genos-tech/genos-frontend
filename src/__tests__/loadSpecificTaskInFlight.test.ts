/**
 * MIP-968: `loadSpecificTask` shares ONE load between concurrent callers.
 *
 * Opening a task used to fire `getTask` three times per click, because three
 * independent effects each called the loader and nothing was shared: each call
 * did its own IndexedDB read, its own GET and its own IndexedDB write. The
 * loader now hands every caller that asks for the same task, with the same
 * freshness bound, the load that is already running.
 *
 * What must hold, and what each test pins:
 *   - concurrent callers share the request, the IndexedDB read and the result;
 *   - a different freshness bound is a different question, so it is its own load;
 *   - `forceRefresh` never joins (and never reads the cache);
 *   - sharing is for the time a load is in flight only: a later call refetches;
 *   - a save forgets the running load, so nobody is handed a pre-save object.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadSpecificTask } from "../features/tasks/services/loadSpecificTask";
import { forgetInFlightTask } from "../features/tasks/services/taskLoadInFlight";
import { UserProps } from "../types/admin";

const getCachedFullTask = vi.fn();
const cacheFullTask = vi.fn();
vi.mock("../db/services/task-full.service", () => ({
    getCachedFullTask: (...args: unknown[]) => getCachedFullTask(...args),
    cacheFullTask: (...args: unknown[]) => cacheFullTask(...args),
}));

const apiGet = vi.fn();
vi.mock("../services/api", () => ({
    authApi: () => ({ get: (...args: unknown[]) => apiGet(...args) }),
}));

const me = { userId: "u1", teamId: "t1" } as UserProps;

/** A promise the test settles by hand, to keep a load "in flight". */
const deferred = <T>() => {
    let resolve!: (v: T) => void;
    let reject!: (e: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
        resolve = res;
        reject = rej;
    });
    return { promise, resolve, reject };
};

const taskBody = (updatedAt = "2026-11-01 10:00:00") => [{ id: 7, title: "T", updatedAt }];

beforeEach(() => {
    vi.clearAllMocks();
    getCachedFullTask.mockResolvedValue(null);
    cacheFullTask.mockResolvedValue(undefined);
    apiGet.mockImplementation(async () => ({ data: taskBody() }));
});

describe("loadSpecificTask — in-flight dedupe", () => {
    it("three concurrent calls make one GET and one IndexedDB read, and share the result", async () => {
        const gate = deferred<{ data: unknown }>();
        apiGet.mockImplementation(() => gate.promise);

        const calls = [
            loadSpecificTask(me, 10, 7, "tok"),
            loadSpecificTask(me, 10, 7, "tok"),
            loadSpecificTask(me, 10, 7, "tok"),
        ];
        gate.resolve({ data: taskBody() });
        const [a, b, c] = await Promise.all(calls);

        expect(apiGet).toHaveBeenCalledTimes(1);
        expect(getCachedFullTask).toHaveBeenCalledTimes(1);
        expect(cacheFullTask).toHaveBeenCalledTimes(1);
        expect(a).toBe(b);
        expect(b).toBe(c);
        expect(a[0].title).toBe("T");
    });

    it("shares an IndexedDB hit too (one read, one result, no GET)", async () => {
        const cached = {
            id: 7,
            title: "Cached",
            updatedAt: "2026-11-01 10:00:00",
            attachments: [],
        };
        const gate = deferred<typeof cached>();
        getCachedFullTask.mockImplementation(() => gate.promise);

        const calls = [loadSpecificTask(me, 10, 7, "tok"), loadSpecificTask(me, 10, 7, "tok")];
        gate.resolve(cached);
        const [a, b] = await Promise.all(calls);

        expect(getCachedFullTask).toHaveBeenCalledTimes(1);
        expect(apiGet).not.toHaveBeenCalled();
        expect(a).toBe(b);
        expect(a[0].title).toBe("Cached");
    });

    it("a different freshness bound is its own request", async () => {
        const gate = deferred<{ data: unknown }>();
        apiGet.mockImplementation(() => gate.promise);

        const calls = [
            loadSpecificTask(me, 10, 7, "tok", { expectedMinUpdatedAt: null }),
            loadSpecificTask(me, 10, 7, "tok", { expectedMinUpdatedAt: "2026-11-01 11:00:00" }),
            // Same bound as the second: shares with it.
            loadSpecificTask(me, 10, 7, "tok", { expectedMinUpdatedAt: "2026-11-01 11:00:00" }),
        ];
        gate.resolve({ data: taskBody() });
        await Promise.all(calls);

        expect(apiGet).toHaveBeenCalledTimes(2);
    });

    it("a different task, project or team never shares", async () => {
        const gate = deferred<{ data: unknown }>();
        apiGet.mockImplementation(() => gate.promise);

        const calls = [
            loadSpecificTask(me, 10, 7, "tok"),
            loadSpecificTask(me, 10, 8, "tok"),
            loadSpecificTask(me, 11, 7, "tok"),
            loadSpecificTask({ ...me, teamId: "t2" } as UserProps, 10, 7, "tok"),
        ];
        gate.resolve({ data: taskBody() });
        await Promise.all(calls);

        expect(apiGet).toHaveBeenCalledTimes(4);
    });

    it("forceRefresh does not join a running load and skips the cache read", async () => {
        const gate = deferred<{ data: unknown }>();
        apiGet.mockImplementation(() => gate.promise);

        const normal = loadSpecificTask(me, 10, 7, "tok");
        const forced = loadSpecificTask(me, 10, 7, "tok", { forceRefresh: true });
        gate.resolve({ data: taskBody() });
        await Promise.all([normal, forced]);

        expect(apiGet).toHaveBeenCalledTimes(2);
        // Only the normal call looked at IndexedDB.
        expect(getCachedFullTask).toHaveBeenCalledTimes(1);
    });

    it("sharing lasts only while the load is in flight: the next call refetches", async () => {
        await loadSpecificTask(me, 10, 7, "tok");
        await loadSpecificTask(me, 10, 7, "tok");

        expect(getCachedFullTask).toHaveBeenCalledTimes(2);
        expect(apiGet).toHaveBeenCalledTimes(2);
    });

    it("after forgetInFlightTask a new caller starts its own load, not the pre-save one", async () => {
        const first = deferred<{ data: unknown }>();
        const second = deferred<{ data: unknown }>();
        apiGet
            .mockImplementationOnce(() => first.promise)
            .mockImplementationOnce(() => second.promise);

        const before = loadSpecificTask(me, 10, 7, "tok");
        // A save lands while the load is running.
        forgetInFlightTask(7);
        const after = loadSpecificTask(me, 10, 7, "tok");

        first.resolve({ data: taskBody("2026-11-01 10:00:00") });
        second.resolve({ data: taskBody("2026-11-01 12:00:00") });

        // The pre-save caller still gets what it asked for; the later one is
        // NOT handed the pre-save object.
        expect((await before)[0].updatedAt).toBe("2026-11-01 10:00:00");
        expect((await after)[0].updatedAt).toBe("2026-11-01 12:00:00");
        expect(apiGet).toHaveBeenCalledTimes(2);
    });

    it("forgetInFlightTask(7) leaves task 70 alone (no prefix collision)", async () => {
        const gate = deferred<{ data: unknown }>();
        apiGet.mockImplementation(() => gate.promise);

        const seventy = loadSpecificTask(me, 10, 70, "tok");
        forgetInFlightTask(7);
        const seventyAgain = loadSpecificTask(me, 10, 70, "tok");
        gate.resolve({ data: taskBody() });
        await Promise.all([seventy, seventyAgain]);

        expect(apiGet).toHaveBeenCalledTimes(1);
    });

    it("a failed load resolves an empty list for every sharer, and the next call retries", async () => {
        const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});
        const gate = deferred<{ data: unknown }>();
        apiGet.mockImplementationOnce(() => gate.promise);

        const calls = [loadSpecificTask(me, 10, 7, "tok"), loadSpecificTask(me, 10, 7, "tok")];
        gate.reject(new Error("boom"));
        expect(await Promise.all(calls)).toEqual([[], []]);

        const retry = await loadSpecificTask(me, 10, 7, "tok");
        expect(retry[0].title).toBe("T");
        expect(apiGet).toHaveBeenCalledTimes(2);
        errorSpy.mockRestore();
    });
});
