/**
 * MIP-987: a task load that fails still hands the caller an ARRAY.
 *
 * `loadSpecificTask` used to resolve `undefined` when the request failed or
 * there was no auth token, while its callers declare `TaskProps[]` and several
 * read `.length` straight away (the parent row of a subtask, two activity
 * rows, the refresh after a tag change): each of those threw on a failed load.
 * The one that matters on screen is the subtask's parent: the throw skipped
 * `setParentTask`, so a subtask whose parent failed to load kept showing the
 * previous task's parent.
 *
 * Pinned here: the service never resolves `undefined`; the throwing callers'
 * read (`result.length === 1 ? result[0] : undefined`) therefore gives "no
 * parent" for a failure, and a success still gives the task.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadSpecificTask } from "../features/tasks/services/loadSpecificTask";
import { UserProps } from "../types/admin";

const getCachedFullTask = vi.fn();
const cacheFullTask = vi.fn();
vi.mock("../db/services/task-full.service", () => ({
    getCachedFullTask: (...args: unknown[]) => getCachedFullTask(...args),
    cacheFullTask: (...args: unknown[]) => cacheFullTask(...args),
}));

const apiGet = vi.fn();
let apiAvailable = true;
vi.mock("../services/api", () => ({
    authApi: () => (apiAvailable ? { get: (...args: unknown[]) => apiGet(...args) } : null),
}));

const me = { userId: "u1", teamId: "t1" } as UserProps;

// The read TaskMainBlock does with the parent's load result.
const parentFrom = (result: { length: number; [i: number]: unknown }) =>
    result.length === 1 ? result[0] : undefined;

beforeEach(() => {
    vi.clearAllMocks();
    apiAvailable = true;
    getCachedFullTask.mockResolvedValue(null);
    cacheFullTask.mockResolvedValue(undefined);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("loadSpecificTask — a failed load", () => {
    it("resolves [] when the request fails", async () => {
        apiGet.mockRejectedValue(new Error("network down"));
        const result = await loadSpecificTask(me, 10, 41, "tok");
        expect(result).toEqual([]);
        expect(parentFrom(result)).toBeUndefined();
    });

    it("resolves [] when the server refuses (403 / 404 style rejection)", async () => {
        apiGet.mockRejectedValue(Object.assign(new Error("Forbidden"), { isAxiosError: true }));
        expect(await loadSpecificTask(me, 10, 42, "tok")).toEqual([]);
    });

    it("resolves [] when there is no auth token (no api client)", async () => {
        apiAvailable = false;
        expect(await loadSpecificTask(me, 10, 43, null)).toEqual([]);
        expect(apiGet).not.toHaveBeenCalled();
    });

    it("resolves [] when the IndexedDB read itself fails", async () => {
        getCachedFullTask.mockRejectedValue(new Error("idb closed"));
        expect(await loadSpecificTask(me, 10, 44, "tok")).toEqual([]);
    });

    it("a successful load is unchanged: the task comes back and is cached", async () => {
        apiGet.mockResolvedValue({ data: [{ id: 45, title: "Parent", updatedAt: "x" }] });
        const result = await loadSpecificTask(me, 10, 45, "tok");
        expect(parentFrom(result)).toMatchObject({ id: 45, title: "Parent" });
        expect(cacheFullTask).toHaveBeenCalledTimes(1);
    });

    it("an empty answer from the server stays an empty list", async () => {
        apiGet.mockResolvedValue({ data: [] });
        expect(await loadSpecificTask(me, 10, 46, "tok")).toEqual([]);
    });
});
