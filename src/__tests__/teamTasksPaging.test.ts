/**
 * The team's tasks follow the server's pages to the end (MIP-807).
 *
 * `getTeamTasksPage` answers `{tasks, has_more, next_cursor}`. The team load
 * EMPTIES the shared task store and forgets every per-project checkpoint before
 * it refills, so a list that stopped at the first page would evict every task
 * past the cut for good, and the dashboard's capacity bars would under-count a
 * member's cross-project load. Both ends here are real: the loader, the worker
 * handler and an in-memory IndexedDB; only the network is faked.
 */

import "fake-indexeddb/auto";

import { AxiosError } from "axios";
import { deleteDB } from "idb";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../db/config";
import { CheckpointRepository, TaskRepository } from "../db/repositories";
import { tasksHandlers } from "../db/workers/handlers/tasks.handlers";
import { loadTeamTasks } from "../features/tasks/services/loadTeamTasks";
import { authApi } from "../services/api";
import type { UserProps } from "../types/admin";

vi.mock("../services/api", () => ({ authApi: vi.fn() }));

const myself = { userId: "u-me", teamId: "team-a" } as UserProps;

const task = (n: number) => ({
    id: String(n),
    title: `task ${n}`,
    projectId: 1,
    teamId: "team-a",
    status: "Open",
    tags: [],
});

/** A server holding `total` tasks, `pageSize` at a time. */
const serve = (total: number, pageSize: number) => {
    const all = Array.from({ length: total }, (_, i) => task(i + 1));
    const get = vi.fn(async (url: string) => {
        const query = new URLSearchParams(url.split("?")[1] ?? "");
        const start = query.get("cursor") ? Number(query.get("cursor")) : 0;
        const more = start + pageSize < total;
        return {
            data: {
                tasks: all.slice(start, start + pageSize),
                has_more: more,
                next_cursor: more ? String(start + pageSize) : null,
            },
        };
    });
    vi.mocked(authApi).mockReturnValue({ get } as never);
    return { all, get };
};

const urlOf = (get: ReturnType<typeof vi.fn>, call: number) => String(get.mock.calls[call][0]);

const httpError = (status: number) => {
    const err = new AxiosError("fail");
    err.response = { status, data: {} } as never;
    return err;
};

describe("loadTeamTasks follows the pages", () => {
    beforeEach(() => {
        vi.mocked(authApi).mockReset();
        vi.spyOn(console, "error").mockImplementation(() => {});
    });

    it("returns every task of a team larger than one page, in order", async () => {
        serve(25, 10);

        const rows = await loadTeamTasks(myself, "tok");

        expect(rows.map((r: { id: string }) => r.id)).toEqual(
            Array.from({ length: 25 }, (_, i) => String(i + 1))
        );
    });

    it("sends the cursor on every page after the first, and not on the first", async () => {
        const { get } = serve(25, 10);

        await loadTeamTasks(myself, "tok");

        expect(get).toHaveBeenCalledTimes(3);
        expect(urlOf(get, 0)).not.toContain("cursor=");
        expect(urlOf(get, 1)).toContain("cursor=10");
        expect(urlOf(get, 2)).toContain("cursor=20");
        for (let i = 0; i < 3; i += 1) {
            expect(urlOf(get, i)).toContain("/task/getTeamTasksPage/");
            expect(urlOf(get, i)).toContain("team_id=team-a");
            expect(urlOf(get, i)).toContain("limit=500");
        }
    });

    it("makes one request for a team that fits a page", async () => {
        const { get } = serve(3, 10);

        const rows = await loadTeamTasks(myself, "tok");

        expect(rows).toHaveLength(3);
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("returns nothing, not the pages so far, when a later page fails", async () => {
        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: { tasks: [task(1)], has_more: true, next_cursor: "1" },
            })
            .mockRejectedValueOnce(httpError(500));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        expect(await loadTeamTasks(myself, "tok")).toBeUndefined();
    });

    it("gives up on a server that never says it is done", async () => {
        const get = vi.fn(async () => ({
            data: { tasks: [task(1)], has_more: true, next_cursor: "x" },
        }));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        expect(await loadTeamTasks(myself, "tok")).toBeUndefined();
        expect(get).toHaveBeenCalledTimes(100);
    });

    it("uses the old route on a server that has no paged one", async () => {
        const legacy = [task(1), task(2)];
        const get = vi.fn(async (url: string) => {
            if (url.includes("getTeamTasksPage")) throw httpError(404);
            return { data: legacy };
        });
        vi.mocked(authApi).mockReturnValue({ get } as never);

        expect(await loadTeamTasks(myself, "tok")).toEqual(legacy);
        expect(String(get.mock.calls[1][0])).toBe("/task/getTeamTasks/?team_id=team-a");
    });

    it("does not treat a 404 on a LATER page as 'no paged route'", async () => {
        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: { tasks: [task(1)], has_more: true, next_cursor: "1" },
            })
            .mockRejectedValueOnce(httpError(404));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        expect(await loadTeamTasks(myself, "tok")).toBeUndefined();
        expect(get).toHaveBeenCalledTimes(2);
    });

    it("does not fall back on a 403", async () => {
        const get = vi.fn().mockRejectedValue(httpError(403));
        vi.mocked(authApi).mockReturnValue({ get } as never);

        expect(await loadTeamTasks(myself, "tok")).toBeUndefined();
        expect(get).toHaveBeenCalledTimes(1);
    });
});

describe("the team load reconciles only a complete list", () => {
    const load = () => tasksHandlers.loadTeamTasks({ myself, accessToken: "tok" } as never);
    const stored = async () =>
        (await new TaskRepository().getAllTasks()).map((r) => String(r.id)).sort();

    beforeEach(async () => {
        vi.mocked(authApi).mockReset();
        vi.spyOn(console, "error").mockImplementation(() => {});
        vi.spyOn(console, "warn").mockImplementation(() => {});
        await deleteDB(DB_NAME);
    });

    it("stores every task of a team larger than one page and evicts nothing", async () => {
        serve(25, 10);

        await load();

        expect(await stored()).toEqual(Array.from({ length: 25 }, (_, i) => String(i + 1)).sort());
    });

    it("keeps the store and the checkpoints when the load fails part way", async () => {
        serve(5, 10);
        await load();
        await new CheckpointRepository().setCheckpoint("tasks:1", "T1");
        const before = await stored();

        const get = vi
            .fn()
            .mockResolvedValueOnce({
                data: { tasks: [task(1)], has_more: true, next_cursor: "1" },
            })
            .mockRejectedValueOnce(httpError(500));
        vi.mocked(authApi).mockReturnValue({ get } as never);
        await load();

        expect(await stored()).toEqual(before);
        expect(await new CheckpointRepository().getCheckpoint("tasks:1")).toBe("T1");
    });

    it("replaces what the store held with the new list, and forgets the checkpoints", async () => {
        serve(5, 10);
        await load();
        await new CheckpointRepository().setCheckpoint("tasks:1", "T1");

        serve(2, 10);
        await load();

        expect(await stored()).toEqual(["1", "2"]);
        expect(await new CheckpointRepository().getCheckpoint("tasks:1")).toBeNull();
    });

    it("an empty team empties the store (a complete answer is trusted)", async () => {
        serve(5, 10);
        await load();

        serve(0, 10);
        await load();

        expect(await stored()).toEqual([]);
    });
});
