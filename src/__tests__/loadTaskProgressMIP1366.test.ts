/**
 * MIP-1366: `loadTaskProgress`, the read behind the "Under it" view.
 *
 * A failed read is `null` (so the feed offers Retry instead of saying nothing has
 * changed), a page is asked for with the parameters the endpoint takes, and the
 * task's own `lastProgressAt` is part of the cache key: it moves when anything
 * below the task changes, so a change gets a fresh read, never a cached page from
 * before it.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { loadTaskProgress } from "../features/tasks/services/loadTaskProgress";
import { authApi } from "../services/api";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const get = vi.fn();
let counter = 0;
// A task id no other test used: the cache is module-level.
const fresh = () => 5000 + ++counter;

beforeEach(() => {
    get.mockReset();
    vi.mocked(authApi).mockReset();
    vi.mocked(authApi).mockReturnValue({ get } as never);
    vi.spyOn(console, "error").mockImplementation(() => {});
});

describe("loadTaskProgress", () => {
    it("asks for the task's progress with the parameters the endpoint takes", async () => {
        get.mockResolvedValue({ data: { entries: [], nextCursor: null } });
        const id = fresh();
        await loadTaskProgress("tok", id, { minDepth: 1, limit: 30, cursor: "c-1", version: "v" });
        const url = get.mock.calls[0][0] as string;
        expect(url.startsWith("/task/progress/?")).toBe(true);
        const params = new URLSearchParams(url.split("?")[1]);
        expect(Object.fromEntries(params)).toEqual({
            task_id: String(id),
            min_depth: "1",
            limit: "30",
            cursor: "c-1",
        });
    });

    it("returns the entries and the next cursor", async () => {
        get.mockResolvedValue({ data: { entries: [{ activityId: 1 }], nextCursor: "n" } });
        const page = await loadTaskProgress("tok", fresh());
        expect(page).toEqual({ entries: [{ activityId: 1 }], nextCursor: "n" });
    });

    it("treats an answer of the wrong shape as an empty page, not a crash", async () => {
        get.mockResolvedValue({ data: "<html>" });
        expect(await loadTaskProgress("tok", fresh())).toEqual({ entries: [], nextCursor: null });
    });

    it("is null when the request fails, and a failure is not cached", async () => {
        const id = fresh();
        get.mockRejectedValueOnce(new Error("offline"));
        expect(await loadTaskProgress("tok", id)).toBeNull();
        get.mockResolvedValueOnce({ data: { entries: [{ activityId: 2 }], nextCursor: null } });
        expect((await loadTaskProgress("tok", id))?.entries).toHaveLength(1);
    });

    it("is null without a login", async () => {
        vi.mocked(authApi).mockReturnValue(null as never);
        expect(await loadTaskProgress(null, fresh())).toBeNull();
        expect(get).not.toHaveBeenCalled();
    });

    it("answers the same question from the cache, and a new lastProgressAt asks again", async () => {
        const id = fresh();
        get.mockResolvedValue({ data: { entries: [], nextCursor: null } });
        await loadTaskProgress("tok", id, { version: "v1" });
        await loadTaskProgress("tok", id, { version: "v1" });
        expect(get).toHaveBeenCalledTimes(1);
        await loadTaskProgress("tok", id, { version: "v2" });
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("keeps pages apart: the next page is not the first", async () => {
        const id = fresh();
        get.mockResolvedValue({ data: { entries: [], nextCursor: null } });
        await loadTaskProgress("tok", id, { version: "v" });
        await loadTaskProgress("tok", id, { version: "v", cursor: "c" });
        expect(get).toHaveBeenCalledTimes(2);
    });
});
