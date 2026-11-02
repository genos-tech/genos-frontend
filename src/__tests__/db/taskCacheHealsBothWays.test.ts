/**
 * The browser's copy of a project's tasks has to be checkable in BOTH
 * directions, and a full load has to REPLACE it (MIP-945).
 *
 * `syncWithCheckpoint` stores a watermark and afterwards asks the server only
 * for what changed. That left two holes:
 *   - the drift check only fired when the store held FEWER rows than the
 *     server's `totalCount`. A row the server no longer has (a hard-deleted
 *     task, a milestone removed by a bulk write) never fired it, and one
 *     such ghost hid one missing row, because the count balanced;
 *   - a full load only upserted, so even a forced one could not evict it.
 *
 * Real in-memory IndexedDB (fake-indexeddb) so the task store, its projectId
 * index and the checkpoint store behave as they do in the browser. The server
 * is a small fake that answers "what changed" with a claim (`totalCount`,
 * optionally `idSum`) and "everything" with the list, like the real route.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterAll, afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { TaskRepository } from "../../db/repositories";
import { CheckpointRepository } from "../../db/repositories/checkpoints";
import { tasksHandlers } from "../../db/workers/handlers/tasks.handlers";
import {
    loadProjectTasksFromApi,
    type ProjectTasksDeltaResponse,
} from "../../features/tasks/services/loadProjectTasksFromApi";
import type { UserProps } from "../../types/admin";
import type { TaskTableProps } from "../../types/tasks";

vi.mock("../../features/tasks/services/loadProjectTasksFromApi", () => ({
    loadProjectTasksFromApi: vi.fn(),
}));
vi.mock("../../features/tasks/services/loadTeamTasks", () => ({
    loadTeamTasks: vi.fn(),
}));
const apiGet = vi.fn();
vi.mock("../../services/api", () => ({
    authApi: () => ({ get: apiGet }),
}));

// initDB never closes the connections it opens; deleteDB then logs a
// `blocking` warning as it forces them shut. Expected teardown noise. The
// same spy sees the one line the code under test logs, which is asserted.
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

const me = { userId: "u-1", teamId: "team-a" } as UserProps;

// What the server stamps on a row: `str(ts_updated_at)`.
const SERVER_TIME = "2026-11-02T14:05:13.200904+00:00";
const OLD = "2026-11-02 09:00:00.100000+00:00";

// The module keeps a per-project memory of failed heals, and it outlives a
// test, so each test gets a project of its own.
let nextProject = 100;
let projectId = 0;

const taskRow = (id: number, project = projectId, updatedAt: string | null = OLD) =>
    ({
        id: String(id),
        title: `task ${id}`,
        projectId: project,
        teamId: "team-a",
        status: "Open",
        tags: [],
        updatedAt,
    }) as unknown as TaskTableProps;

const sumOf = (ids: number[]) => ids.reduce((a, b) => a + b, 0);

/**
 * The server's side of the conversation. `ids` is what it really holds;
 * `claimedCount` lets a test make it promise a number it will not deliver.
 */
const server = {
    ids: [] as number[],
    sendIdSum: true,
    claimedCount: undefined as number | undefined,
    serverTime: SERVER_TIME,
};

const serveFake = () => {
    vi.mocked(loadProjectTasksFromApi).mockImplementation(async (_me, pid, _token, since) => {
        const tasks = server.ids.map((id) => taskRow(id, pid));
        const answer: ProjectTasksDeltaResponse = {
            serverTime: server.serverTime,
            tasks: since === null ? tasks : [],
            forceFull: false,
        };
        // Only an incremental answer carries a claim, like the real route.
        if (since !== null) {
            answer.totalCount = server.claimedCount ?? server.ids.length;
            if (server.sendIdSum) answer.idSum = sumOf(server.ids);
        }
        return answer;
    });
};

const load = () =>
    tasksHandlers.loadProjectTasks({ myself: me, projectId, accessToken: "token" } as never);

const callsMade = () => vi.mocked(loadProjectTasksFromApi).mock.calls.length;
const sinceOfCall = (call: number) => vi.mocked(loadProjectTasksFromApi).mock.calls[call][3];

const idsOf = async (project = projectId) =>
    (await new TaskRepository().getTasksByProject(project)).map((r) => Number(r.id)).sort();

/** A browser that already synced once: rows in the store, a watermark past them. */
const seed = async (rows: TaskTableProps[], checkpoint: string | null = "T0") => {
    await new TaskRepository().batchInsertTasks(rows);
    if (checkpoint) {
        await new CheckpointRepository().setCheckpoint(`tasks:v2:${projectId}`, checkpoint);
    }
};

const failedHealWarnings = () =>
    warnSpy.mock.calls.filter((c) => String(c[0]).includes("[loadProjectTasks]"));

beforeEach(async () => {
    vi.clearAllMocks();
    await deleteDB(DB_NAME);
    projectId = nextProject++;
    server.ids = [];
    server.sendIdSum = true;
    server.claimedCount = undefined;
    server.serverTime = SERVER_TIME;
    serveFake();
});

afterEach(() => {
    vi.useRealTimers();
});

describe("a row the server no longer has", () => {
    it("is evicted by one extra full load, although the count says 'more', not 'fewer'", async () => {
        // The ghost: id 3 was deleted for good on the server. The browser
        // never heard, and a changes-since answer cannot mention it.
        await seed([taskRow(1), taskRow(2), taskRow(3)]);
        server.ids = [1, 2];
        server.sendIdSum = false; // the count alone has to be enough

        await load();

        expect(callsMade()).toBe(2);
        expect(sinceOfCall(0)).toBe("T0");
        expect(sinceOfCall(1)).toBeNull();
        expect(await idsOf()).toEqual([1, 2]);
        expect(failedHealWarnings()).toHaveLength(0);
    });

    it("costs nothing when the store already matches", async () => {
        await seed([taskRow(1), taskRow(2)]);
        server.ids = [1, 2];

        await load();

        expect(callsMade()).toBe(1);
        expect(await idsOf()).toEqual([1, 2]);
    });
});

describe("a row the server has and the browser lacks", () => {
    it("is fetched by one extra full load (the behaviour that already existed)", async () => {
        await seed([taskRow(1)]);
        server.ids = [1, 2];

        await load();

        expect(callsMade()).toBe(2);
        expect(sinceOfCall(1)).toBeNull();
        expect(await idsOf()).toEqual([1, 2]);
    });
});

describe("one ghost and one missing row at the same time", () => {
    // Same number of rows on both sides: the count balances. Only the sum
    // of ids tells the sets apart.
    it("is caught when the server sends the sum of ids", async () => {
        await seed([taskRow(1), taskRow(2), taskRow(4)]); // 4 is the ghost
        server.ids = [1, 2, 3]; // 3 is the one the browser lacks

        await load();

        expect(callsMade()).toBe(2);
        expect(await idsOf()).toEqual([1, 2, 3]);
    });

    it("cannot be told apart by count alone, so an old API leaves it (the stated fallback)", async () => {
        await seed([taskRow(1), taskRow(2), taskRow(4)]);
        server.ids = [1, 2, 3];
        server.sendIdSum = false;

        await load();

        expect(callsMade()).toBe(1);
        expect(await idsOf()).toEqual([1, 2, 4]);
    });

    it("does not reload when count and sum both agree", async () => {
        await seed([taskRow(1), taskRow(2), taskRow(3)]);
        server.ids = [1, 2, 3];

        await load();

        expect(callsMade()).toBe(1);
    });

    it("reads a sum of 0 as a claim, not as 'absent'", async () => {
        // An answer that carries only the sum, saying the project is empty.
        // The store holds a row; the falsy 0 must not read as "no claim".
        await seed([taskRow(5)]);
        server.ids = [];
        vi.mocked(loadProjectTasksFromApi).mockResolvedValueOnce({
            serverTime: SERVER_TIME,
            tasks: [],
            forceFull: false,
            idSum: 0,
        });

        await load();

        expect(callsMade()).toBe(2);
        expect(await idsOf()).toEqual([]);
    });

    it("does not reload a project that is empty on both sides", async () => {
        await seed([], "T0");
        server.ids = [];

        await load();

        expect(callsMade()).toBe(1);
    });
});

describe("an API that predates idSum", () => {
    it("is compared by count only and still works", async () => {
        await seed([taskRow(1), taskRow(2)]);
        server.ids = [1, 2];
        server.sendIdSum = false;
        await load();
        expect(callsMade()).toBe(1);

        // And a count gap is still caught.
        server.ids = [1, 2, 3];
        await load();
        expect(callsMade()).toBe(3);
        expect(await idsOf()).toEqual([1, 2, 3]);
    });

    it("an answer with no claim at all is not checked", async () => {
        // The oldest servers sent neither field.
        await seed([taskRow(1), taskRow(9)]);
        vi.mocked(loadProjectTasksFromApi).mockResolvedValueOnce({
            serverTime: SERVER_TIME,
            tasks: [],
            forceFull: false,
        });

        await load();

        expect(callsMade()).toBe(1);
        expect(await idsOf()).toEqual([1, 9]);
    });
});

describe("a full load replaces this project's rows and only this project's", () => {
    it("leaves another project's rows alone, ghosts included", async () => {
        const other = projectId + 5000;
        await seed([taskRow(1), taskRow(2), taskRow(3)]);
        await new TaskRepository().batchInsertTasks([
            taskRow(50, other),
            taskRow(51, other),
            taskRow(52, other),
        ]);
        await new CheckpointRepository().setCheckpoint(`tasks:v2:${other}`, "T0-other");
        server.ids = [1, 2];

        await load();

        expect(await idsOf()).toEqual([1, 2]);
        expect(await idsOf(other)).toEqual([50, 51, 52]);
        expect(await new CheckpointRepository().getCheckpoint(`tasks:v2:${other}`)).toBe(
            "T0-other"
        );
    });

    it("evicts on a plain first load too (no checkpoint, nothing to compare)", async () => {
        await seed([taskRow(1), taskRow(2)], null);
        server.ids = [2, 3];

        await load();

        expect(callsMade()).toBe(1);
        expect(await idsOf()).toEqual([2, 3]);
    });

    it("does not touch a store that the answer did not contradict on an incremental load", async () => {
        await seed([taskRow(1), taskRow(2)]);
        server.ids = [1, 2];

        await load();

        expect(await idsOf()).toEqual([1, 2]);
    });
});

describe("a row saved while the load was in flight", () => {
    const serverMs = Date.parse(SERVER_TIME);
    const localFormat = (ms: number) => {
        const d = new Date(ms);
        const p = (n: number) => String(n).padStart(2, "0");
        return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}:${p(d.getSeconds())}`;
    };

    const fullLoadHolding = async (...extra: TaskTableProps[]) => {
        await seed([taskRow(1), ...extra], null);
        server.ids = [1];
        await load();
        return idsOf();
    };

    it("survives when its updatedAt is newer than the answer's serverTime minus 60 s", async () => {
        const kept = await fullLoadHolding(
            taskRow(2, projectId, "2026-11-02 14:05:30.000000+00:00"), // after the snapshot
            taskRow(3, projectId, "2026-11-02T14:04:20.000Z") // 53 s before it
        );
        expect(kept).toEqual([1, 2, 3]);
    });

    it("goes when its updatedAt is older than that", async () => {
        const kept = await fullLoadHolding(
            taskRow(2, projectId, "2026-11-02 14:04:12.000000+00:00"), // 61 s before
            taskRow(3, projectId, OLD)
        );
        expect(kept).toEqual([1]);
    });

    it("is not protected when updatedAt is missing or unreadable", async () => {
        const kept = await fullLoadHolding(
            taskRow(2, projectId, null),
            taskRow(3, projectId, "yesterday-ish"),
            taskRow(4, projectId, "")
        );
        expect(kept).toEqual([1]);
    });

    it("reads the app's own zone-less local time (`getLocalCurrentTimestamp`) as local", async () => {
        const kept = await fullLoadHolding(
            taskRow(2, projectId, localFormat(serverMs - 10_000)),
            taskRow(3, projectId, localFormat(serverMs - 3_600_000))
        );
        expect(kept).toEqual([1, 2]);
    });

    it("does not protect a row the answer explicitly marks deleted", async () => {
        await seed([taskRow(1), taskRow(2, projectId, "2026-11-02 14:05:30.000000+00:00")], null);
        vi.mocked(loadProjectTasksFromApi).mockResolvedValueOnce({
            serverTime: SERVER_TIME,
            tasks: [taskRow(1), { ...taskRow(2), isDeleted: true }],
            forceFull: false,
        });

        await load();

        expect(await idsOf()).toEqual([1]);
    });

    it("an unreadable serverTime protects nothing", async () => {
        server.serverTime = "T9";
        const kept = await fullLoadHolding(taskRow(2, projectId, "2999-01-01 00:00:00+00:00"));
        expect(kept).toEqual([1]);
    });
});

describe("a gap that a full load cannot close", () => {
    // The server promises 5 rows and hands over 2, however often it is asked
    // (a count that disagrees with its own list). Without a memory, every
    // call would pay for a second, useless full load.
    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["Date"] });
        vi.setSystemTime(new Date("2026-11-02T10:00:00Z"));
    });

    const stuckServer = async () => {
        await seed([taskRow(1), taskRow(2)]);
        server.ids = [1, 2];
        server.claimedCount = 5;
        server.sendIdSum = false;
    };

    it("forces one reload per call at most, then leaves it alone for 30 minutes", async () => {
        await stuckServer();

        await load();
        // changes-since, then the forced full load: no third request.
        expect(callsMade()).toBe(2);
        expect(failedHealWarnings()).toHaveLength(1);

        vi.setSystemTime(new Date("2026-11-02T10:29:00Z"));
        await load();
        // Still wrong, but remembered: only the ordinary request goes out.
        expect(callsMade()).toBe(3);
        expect(failedHealWarnings()).toHaveLength(1);

        vi.setSystemTime(new Date("2026-11-02T10:31:00Z"));
        await load();
        // The 30 minutes are over: one more try, one more line.
        expect(callsMade()).toBe(5);
        expect(failedHealWarnings()).toHaveLength(2);
    });

    it("remembers per project", async () => {
        await stuckServer();
        await load();
        expect(callsMade()).toBe(2);

        projectId = nextProject++;
        await stuckServer();
        await load();
        // A different project is not held back by the first one's failure.
        expect(callsMade()).toBe(4);
    });

    it("records nothing when the forced load fixed it, so the next problem heals at once", async () => {
        await seed([taskRow(1), taskRow(2), taskRow(3)]);
        server.ids = [1, 2];
        await load();
        expect(callsMade()).toBe(2);
        expect(await idsOf()).toEqual([1, 2]);
        expect(failedHealWarnings()).toHaveLength(0);

        // A minute later another ghost appears.
        vi.setSystemTime(new Date("2026-11-02T10:01:00Z"));
        await new TaskRepository().batchInsertTasks([taskRow(7)]);
        await load();

        expect(callsMade()).toBe(4);
        expect(await idsOf()).toEqual([1, 2]);
    });

    it("forgets a failed heal as soon as the store agrees with the server again", async () => {
        await stuckServer();
        await load();
        expect(callsMade()).toBe(2);

        // The server's claim becomes truthful, the store agrees: all quiet.
        server.claimedCount = undefined;
        await load();
        expect(callsMade()).toBe(3);

        // A fresh ghost, long before the 30 minutes are up.
        vi.setSystemTime(new Date("2026-11-02T10:05:00Z"));
        await new TaskRepository().batchInsertTasks([taskRow(8)]);
        await load();

        expect(callsMade()).toBe(5);
        expect(await idsOf()).toEqual([1, 2]);
    });
});

describe("the loader hands the server's claim through", () => {
    const realLoader = async () =>
        (
            await vi.importActual<
                typeof import("../../features/tasks/services/loadProjectTasksFromApi")
            >("../../features/tasks/services/loadProjectTasksFromApi")
        ).loadProjectTasksFromApi;

    it("passes totalCount and idSum along, and leaves idSum undefined when absent", async () => {
        const load = await realLoader();
        apiGet.mockResolvedValueOnce({
            data: { server_time: "T1", data: { tasks: [], totalCount: 2, idSum: 9 } },
        });
        expect(await load(me, 1, "token", "T0")).toMatchObject({ totalCount: 2, idSum: 9 });

        apiGet.mockResolvedValueOnce({
            data: { server_time: "T1", data: { tasks: [], totalCount: 2 } },
        });
        const old = await load(me, 1, "token", "T0");
        expect(old?.totalCount).toBe(2);
        expect(old?.idSum).toBeUndefined();
    });
});
