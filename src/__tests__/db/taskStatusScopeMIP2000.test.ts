/**
 * The project load asks only for the statuses a view needs, and keeps its bookkeeping straight
 * (MIP-2000).
 *
 * Real in-memory IndexedDB (fake-indexeddb) behind `tasksHandlers.loadProjectTasks`; the
 * server is a small fake that answers like genos-api #1114: a FULL scoped answer is the
 * wanted rows + their ancestors + the milestone rows, with `statusCounts` over the whole
 * list; a DELTA is never narrowed (a task that moved into a hidden status still arrives),
 * and its `totalCount`/`idSum` count only rows of the requested statuses.
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

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
    projectTasksFailureMessage: (status?: number) =>
        status ? `Failed to load project tasks (HTTP ${status})` : "Failed to load project tasks",
}));
vi.mock("../../features/tasks/services/loadTeamTasks", () => ({
    loadTeamTasks: vi.fn(),
}));
vi.mock("../../services/api", () => ({
    authApi: () => ({ get: vi.fn() }),
}));

const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

const me = { userId: "u-1", teamId: "team-a" } as UserProps;
const SERVER_TIME = "2026-11-02T14:05:13.200904+00:00";
const OLD = "2026-11-02 09:00:00.100000+00:00";
const ACTIVE = ["Open", "WIP", "Blocked", "Pending"];

let nextProject = 5000;
let projectId = 0;

interface FakeRow {
    id: number;
    status: string;
    parent?: number;
    milestone?: boolean;
}

const row = (r: FakeRow, project = projectId) =>
    ({
        id: String(r.id),
        title: `task ${r.id}`,
        projectId: project,
        teamId: "team-a",
        status: r.status,
        parentTaskId: r.parent ?? null,
        isMilestone: r.milestone === true,
        tags: [],
        updatedAt: OLD,
    }) as unknown as TaskTableProps;

const server = {
    rows: [] as FakeRow[],
    /** An API from before `?statuses=`: ignores the parameter, sends no counts. */
    legacy: false,
    /** Rows a delta carries (changed since the watermark). */
    delta: [] as FakeRow[],
    rejectScopedWith400: false,
};

const countsOf = (rows: FakeRow[]) => {
    const out: Record<string, number> = {
        Open: 0,
        WIP: 0,
        Blocked: 0,
        Pending: 0,
        Closed: 0,
        Deleted: 0,
    };
    for (const r of rows) out[r.status] = (out[r.status] ?? 0) + 1;
    return out;
};

/** genos-api's `scope_rows`: wanted rows, every ancestor, the milestone rows. */
const scoped = (rows: FakeRow[], wanted: string[]) => {
    const byId = new Map(rows.map((r) => [r.id, r]));
    const keep = new Set(
        rows.filter((r) => wanted.includes(r.status) || r.milestone).map((r) => r.id)
    );
    for (const id of [...keep]) {
        let parent = byId.get(id)?.parent;
        while (parent !== undefined && byId.has(parent)) {
            keep.add(parent);
            parent = byId.get(parent)?.parent;
        }
    }
    return rows.filter((r) => keep.has(r.id));
};

const serveFake = () => {
    vi.mocked(loadProjectTasksFromApi).mockImplementation(
        async (_me, pid, _token, since, failure, statuses) => {
            const wanted = server.legacy ? null : (statuses ?? null);
            if (wanted && server.rejectScopedWith400) {
                if (failure) failure.status = 400;
                return undefined;
            }
            const answer: ProjectTasksDeltaResponse = {
                serverTime: SERVER_TIME,
                tasks: [],
                forceFull: false,
            };
            if (since === null) {
                const rows = wanted ? scoped(server.rows, [...wanted]) : server.rows;
                answer.tasks = rows.map((r) => row(r, pid));
            } else {
                // Never narrowed by status.
                answer.tasks = server.delta.map((r) => row(r, pid));
                const held = wanted
                    ? server.rows.filter((r) => wanted.includes(r.status))
                    : server.rows;
                answer.totalCount = held.length;
                answer.idSum = held.reduce((a, r) => a + r.id, 0);
            }
            if (wanted) answer.statusCounts = countsOf(server.rows);
            return answer;
        }
    );
};

const load = (statuses: string[] | null) =>
    tasksHandlers.loadProjectTasks({
        myself: me,
        projectId,
        accessToken: "token",
        statuses,
    } as never);

const calls = () => vi.mocked(loadProjectTasksFromApi).mock.calls;
const sentStatuses = (call: number) => calls()[call][5];
const sentSince = (call: number) => calls()[call][3];

const idsInStore = async () =>
    (await new TaskRepository().getTasksByProject(projectId))
        .map((r) => Number(r.id))
        .sort((a, b) => a - b);
const record = () => new CheckpointRepository().getCheckpointRecord(`tasks:v2:${projectId}`);

// 5 active, 6 closed; #11 is an Open child of the Closed #10 (closed-by-ancestor).
const PROJECT: FakeRow[] = [
    { id: 1, status: "Open" },
    { id: 2, status: "WIP" },
    { id: 3, status: "Blocked" },
    { id: 4, status: "Pending" },
    { id: 5, status: "Open", parent: 10 },
    { id: 6, status: "Closed" },
    { id: 7, status: "Closed" },
    { id: 8, status: "Closed" },
    { id: 9, status: "Closed", milestone: true },
    { id: 10, status: "Closed" },
];

beforeEach(async () => {
    vi.clearAllMocks();
    await deleteDB(DB_NAME);
    projectId = nextProject++;
    server.rows = PROJECT;
    server.legacy = false;
    server.delta = [];
    server.rejectScopedWith400 = false;
    serveFake();
});

describe("the first load", () => {
    it("sends the statuses it needs and stores only those rows, plus ancestors and milestones", async () => {
        const held = await load(ACTIVE);
        expect(sentStatuses(0)).toEqual(ACTIVE);
        // 1-4 and 5 wanted; 10 is 5's ancestor; 9 is a milestone row. 6, 7, 8 stay on the server.
        expect(await idsInStore()).toEqual([1, 2, 3, 4, 5, 9, 10]);
        expect(held.statuses).toEqual(ACTIVE);
        expect(held.statusCounts?.Closed).toBe(5);
        expect((await record())?.statuses).toEqual(ACTIVE);
    });

    it("sends nothing when everything is needed, and the watermark then means All", async () => {
        const held = await load(null);
        expect(sentStatuses(0)).toBeNull();
        expect(await idsInStore()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(held.statuses).toBeNull();
        expect((await record())?.statuses).toBeUndefined();
    });

    it("a caller that does not say what it needs gets every status, as before", async () => {
        await tasksHandlers.loadProjectTasks({
            myself: me,
            projectId,
            accessToken: "token",
        } as never);
        expect(sentStatuses(0)).toBeNull();
    });
});

describe("a later load", () => {
    it("is a delta over what is held, and never narrower", async () => {
        await load(ACTIVE);
        await load(["Open"]);
        expect(sentSince(1)).not.toBeNull();
        expect(sentStatuses(1)).toEqual(ACTIVE);
    });

    it("a record from before this change (no statuses) is All: the delta is unscoped", async () => {
        await new TaskRepository().batchInsertTasks(PROJECT.map((r) => row(r)));
        await new CheckpointRepository().setCheckpoint(`tasks:v2:${projectId}`, "T0");
        server.delta = [{ id: 1, status: "WIP" }];
        server.rows = PROJECT.map((r) => (r.id === 1 ? { ...r, status: "WIP" } : r));
        await load(ACTIVE);
        expect(sentSince(0)).toBe("T0");
        expect(sentStatuses(0)).toBeNull();
    });

    it("needing more forgets the watermark and loads the union in full, once", async () => {
        await load(ACTIVE);
        const held = await load(null); // Closed turned on
        expect(sentSince(1)).toBeNull();
        expect(sentStatuses(1)).toBeNull();
        expect(await idsInStore()).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
        expect(held.statuses).toBeNull();
        expect((await record())?.statuses).toBeUndefined();
        // Off and on again: the store holds everything, so it is a plain delta.
        await load(ACTIVE);
        await load(null);
        expect(calls()).toHaveLength(4);
        expect(sentSince(2)).not.toBeNull();
        expect(sentSince(3)).not.toBeNull();
    });

    it("widening to one more status loads the union of the two", async () => {
        await load(["Open"]);
        const held = await load(["WIP"]);
        expect(sentStatuses(1)).toEqual(["Open", "WIP"]);
        expect(held.statuses).toEqual(["Open", "WIP"]);
        expect((await record())?.statuses).toEqual(["Open", "WIP"]);
    });
});

describe("what a full scoped answer evicts", () => {
    it("drops rows of statuses that are not held, keeps ancestors and milestones it lists", async () => {
        // A stray Closed row (an earlier delta) and a Closed row nothing needs.
        await new TaskRepository().batchInsertTasks([row({ id: 6, status: "Closed" })]);
        await load(ACTIVE);
        expect(await idsInStore()).not.toContain(6);
        expect(await idsInStore()).toEqual(expect.arrayContaining([5, 9, 10]));
    });
});

describe("the claim a delta makes", () => {
    it("counts only rows of the held statuses: a stray row of another status is no disagreement", async () => {
        await load(ACTIVE);
        // A delta delivered a row that moved into Closed: it is stored (the closed-by-ancestor
        // rule needs it) but the server's count (status in ACTIVE) does not include it.
        server.rows = PROJECT.map((r) => (r.id === 1 ? { ...r, status: "Closed" } : r));
        server.delta = [{ id: 1, status: "Closed" }];
        await load(ACTIVE);
        // Rows held in ACTIVE are now 2..5 and the server says 4: they agree, no reload.
        expect(calls()).toHaveLength(2);
        expect(await idsInStore()).toContain(1);
    });

    it("still heals a missing row inside the held statuses", async () => {
        await load(ACTIVE);
        await new TaskRepository().delete("2" as never);
        await load(ACTIVE);
        // The delta's claim (5 active rows) is short by one: a forced full reload follows.
        expect(calls().some((c, i) => i > 0 && c[3] === null)).toBe(true);
        expect(await idsInStore()).toContain(2);
    });
});

describe("rows that change status while Closed is not loaded", () => {
    it("Closed -> Open appears: the delta carries it and it is stored", async () => {
        await load(ACTIVE);
        server.rows = PROJECT.map((r) => (r.id === 6 ? { ...r, status: "Open" } : r));
        server.delta = [{ id: 6, status: "Open" }];
        await load(ACTIVE);
        expect(await idsInStore()).toContain(6);
        expect(
            (await new TaskRepository().getTasksByProject(projectId)).find((r) => r.id === "6")
                ?.status
        ).toBe("Open");
    });

    it("Open -> Closed leaves the active set; the row stays stored but counts for nothing", async () => {
        await load(ACTIVE);
        server.rows = PROJECT.map((r) => (r.id === 1 ? { ...r, status: "Closed" } : r));
        server.delta = [{ id: 1, status: "Closed" }];
        await load(ACTIVE);
        const stored = await new TaskRepository().getTasksByProject(projectId);
        expect(stored.find((r) => r.id === "1")?.status).toBe("Closed");
        // The next full load would not list it; the table's status filter hides it meanwhile.
        expect(calls()).toHaveLength(2);
    });
});

describe("a server that does not know the parameter", () => {
    it("is detected by the missing counts: the store is then All and the claim is judged on all rows", async () => {
        server.legacy = true;
        const held = await load(ACTIVE);
        expect(held.statuses).toBeNull();
        expect(await idsInStore()).toHaveLength(PROJECT.length);
        expect((await record())?.statuses).toBeUndefined();
        await load(ACTIVE);
        // Nothing to heal on the second load.
        expect(calls().filter((c) => c[3] === null)).toHaveLength(1);
    });

    it("a 400 on a scoped request is retried without the parameter", async () => {
        server.rejectScopedWith400 = true;
        const held = await load(ACTIVE);
        expect(held.statuses).toBeNull();
        expect(sentStatuses(1)).toBeNull();
        expect(await idsInStore()).toHaveLength(PROJECT.length);
    });
});

describe("the scope falling back to All during a delta", () => {
    it("is followed by one full load, because the watermark never covered the older Closed rows", async () => {
        await load(ACTIVE); // a scoped store with a watermark
        server.legacy = true; // the API now ignores the parameter (an older deployment)
        server.delta = [];
        const held = await load(ACTIVE);
        expect(held.statuses).toBeNull();
        // delta (unscoped answer, no counts) + the full load that follows it
        expect(calls().map((c) => c[3] === null)).toEqual([true, false, true]);
        expect(await idsInStore()).toHaveLength(PROJECT.length);
        expect((await record())?.statuses).toBeUndefined();
    });

    it("also when the server refuses the parameter on a delta (400)", async () => {
        await load(ACTIVE);
        server.rejectScopedWith400 = true;
        const held = await load(ACTIVE);
        expect(held.statuses).toBeNull();
        expect(await idsInStore()).toHaveLength(PROJECT.length);
    });
});

describe("readProjectTaskScope", () => {
    it("says what the stored rows hold, and that a never-loaded project has nothing", async () => {
        expect(await tasksHandlers.readProjectTaskScope({ projectId } as never)).toEqual({
            known: false,
            statuses: null,
        });
        await load(ACTIVE);
        expect(await tasksHandlers.readProjectTaskScope({ projectId } as never)).toEqual({
            known: true,
            statuses: ACTIVE,
        });
        await load(null);
        expect(await tasksHandlers.readProjectTaskScope({ projectId } as never)).toEqual({
            known: true,
            statuses: null,
        });
    });
});
