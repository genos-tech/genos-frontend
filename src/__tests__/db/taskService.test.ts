/**
 * IndexedDB tests for the task data layer against a REAL in-memory
 * IndexedDB (fake-indexeddb/auto). Exercising `TaskService` also drives
 * `TaskRepository` (the service delegates to it), so one suite covers
 * both src/db/services/task.service.ts and src/db/repositories/task.ts.
 *
 * The real `initDB()` runs unmocked (first repo access creates the
 * genosData DB at DB_VERSION with the taskMeta store + its projectId /
 * [projectId,status] / assigneeId / [assigneeId,projectId] indexes), so
 * the index-backed query methods hit real indexes. We reset to a clean DB
 * before every test via idb's `deleteDB`.
 *
 * Index queries silently return [] if the stored row lacks the keyed
 * property, so the filtering tests assert POSITIVE retrieval (the right
 * rows, by count + identity), not just that the wrong project is absent.
 *
 * NOTE: `TaskTableProps.id` is typed `string | null`, but the service's
 * key-based methods are typed `(taskId: number)` and the rows are keyed
 * numerically in practice — we follow the runtime contract (numeric ids).
 */

import "fake-indexeddb/auto";

import { deleteDB } from "idb";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

import { DB_NAME } from "../../db/config";
import { TaskService } from "../../db/services/task.service";
import { TaskStatusProps, TaskTableProps } from "../../types/tasks";

// initDB never closes the connections it opens; deleteDB then logs a
// `blocking` warning as it forces them shut. Expected teardown noise.
const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
afterAll(() => warnSpy.mockRestore());

type TaskOverrides = Omit<Partial<TaskTableProps>, "id"> & { id?: number | string | null };

function makeTask(overrides: TaskOverrides = {}): TaskTableProps {
    return {
        id: 1,
        title: null,
        priority: null,
        effortLevel: null,
        createdDate: null,
        updatedAt: null,
        dueDate: null,
        daysLeft: null,
        status: null,
        assigneeId: null,
        assigneeEmail: null,
        assigneeName: null,
        assigneeImgPath: null,
        parentTaskId: null,
        threadId: null,
        tags: [],
        concatTags: null,
        teamId: null,
        projectId: null,
        ...overrides,
    } as TaskTableProps;
}

beforeEach(async () => {
    await deleteDB(DB_NAME);
});

describe("TaskService — CRUD", () => {
    let svc: TaskService;
    beforeEach(() => {
        svc = new TaskService();
    });

    it("saveTask + getTask round-trips a task", async () => {
        expect(await svc.saveTask(makeTask({ id: 1, title: "Alpha" }))).toBe(true);
        const t = await svc.getTask(1);
        expect(t).not.toBeNull();
        expect(t?.title).toBe("Alpha");
    });

    it("getTask returns null for a missing id", async () => {
        expect(await svc.getTask(404)).toBeNull();
    });

    it("saveTask upserts (same id overwrites)", async () => {
        await svc.saveTask(makeTask({ id: 1, title: "Old" }));
        await svc.saveTask(makeTask({ id: 1, title: "New" }));
        expect((await svc.getTask(1))?.title).toBe("New");
        expect((await svc.getAllTasks()).length).toBe(1);
    });

    it("getAllTasks returns every stored task; [] when empty", async () => {
        expect(await svc.getAllTasks()).toEqual([]);
        await svc.batchInsertTasks([
            makeTask({ id: 1 }),
            makeTask({ id: 2 }),
            makeTask({ id: 3 }),
        ]);
        expect((await svc.getAllTasks()).length).toBe(3);
    });

    it("deleteTask removes the row; taskExists reflects it", async () => {
        await svc.saveTask(makeTask({ id: 7 }));
        expect(await svc.taskExists(7)).toBe(true);
        expect(await svc.deleteTask(7)).toBe(true);
        expect(await svc.taskExists(7)).toBe(false);
        expect(await svc.getTask(7)).toBeNull();
    });
});

describe("TaskService — indexed queries", () => {
    let svc: TaskService;
    beforeEach(async () => {
        svc = new TaskService();
        // project 1: two open + one done; project 2: one open. Distinct
        // assignees so the assignee indexes are meaningful too.
        await svc.batchInsertTasks([
            makeTask({ id: 1, projectId: 1, status: "open", assigneeId: "alice" }),
            makeTask({ id: 2, projectId: 1, status: "open", assigneeId: "bob" }),
            makeTask({ id: 3, projectId: 1, status: "done", assigneeId: "alice" }),
            makeTask({ id: 4, projectId: 2, status: "open", assigneeId: "alice" }),
        ]);
    });

    it("getTasksByProject returns only that project's tasks", async () => {
        const p1 = await svc.getTasksByProject(1);
        expect(p1.map((t) => t.id).sort()).toEqual([1, 2, 3]);
        const p2 = await svc.getTasksByProject(2);
        expect(p2.map((t) => t.id)).toEqual([4]);
    });

    it("getTasksByStatus filters on the [projectId, status] compound index", async () => {
        const open1 = await svc.getTasksByStatus(1, "open");
        expect(open1.map((t) => t.id).sort()).toEqual([1, 2]);
        // project 2 'open' must not leak into project 1's result.
        expect((await svc.getTasksByStatus(1, "done")).map((t) => t.id)).toEqual([3]);
    });

    it("getTasksByMultipleStatus flattens across statuses (same project)", async () => {
        const r = await svc.getTasksByMultipleStatus(1, ["open", "done"]);
        expect(r.map((t) => t.id).sort()).toEqual([1, 2, 3]);
    });

    it("getTasksByAssignee spans projects", async () => {
        // alice is on tasks 1, 3 (project 1) and 4 (project 2).
        expect((await svc.getTasksByAssignee("alice")).map((t) => t.id).sort()).toEqual([1, 3, 4]);
        expect((await svc.getTasksByAssignee("bob")).map((t) => t.id)).toEqual([2]);
    });

    it("getTasksByAssigneeAndProject uses the [assigneeId, projectId] compound index", async () => {
        const r = await svc.getTasksByAssigneeAndProject("alice", 1);
        expect(r.map((t) => t.id).sort()).toEqual([1, 3]);
        // alice in project 2 is a single task; bob in project 2 is none.
        expect((await svc.getTasksByAssigneeAndProject("alice", 2)).map((t) => t.id)).toEqual([4]);
        expect(await svc.getTasksByAssigneeAndProject("bob", 2)).toEqual([]);
    });
});

describe("TaskService — getTasks dispatch", () => {
    let svc: TaskService;
    beforeEach(async () => {
        svc = new TaskService();
        await svc.batchInsertTasks([
            makeTask({ id: 1, projectId: 1, status: "open" }),
            makeTask({ id: 2, projectId: 1, status: "done" }),
            makeTask({ id: 3, projectId: 1, status: "blocked" }),
        ]);
    });

    it("no status -> all tasks for the project", async () => {
        expect((await svc.getTasks({ projectId: 1 })).map((t) => t.id).sort()).toEqual([1, 2, 3]);
    });

    it("string status -> single-status filter", async () => {
        expect((await svc.getTasks({ projectId: 1, status: "open" })).map((t) => t.id)).toEqual([
            1,
        ]);
    });

    it("array status -> multi-status filter", async () => {
        const r = await svc.getTasks({ projectId: 1, status: ["open", "blocked"] });
        expect(r.map((t) => t.id).sort()).toEqual([1, 3]);
    });

    it("empty status array returns no tasks (array branch is taken)", async () => {
        // `query.status` is `[]` — truthy, so the array branch runs and
        // Promise.all([]) yields []. Documents current behavior: an empty
        // status filter is NOT treated as "no filter".
        expect(await svc.getTasks({ projectId: 1, status: [] })).toEqual([]);
    });
});

describe("TaskService — mutations & statistics", () => {
    let svc: TaskService;
    beforeEach(() => {
        svc = new TaskService();
    });

    it("updateTaskStatus updates status + updatedAt for an existing task", async () => {
        await svc.saveTask(makeTask({ id: 1, status: "open", updatedAt: null }));
        expect(await svc.updateTaskStatus(1, { status: "done" } as TaskStatusProps)).toBe(true);
        const t = await svc.getTask(1);
        expect(t?.status).toBe("done");
        expect(t?.updatedAt).not.toBeNull();
    });

    it("updateTaskStatus returns false for a missing task (no write)", async () => {
        expect(await svc.updateTaskStatus(999, { status: "done" } as TaskStatusProps)).toBe(false);
        expect(await svc.getAllTasks()).toEqual([]);
    });

    it("updateTaskAssignee updates assignee for an existing task", async () => {
        await svc.saveTask(makeTask({ id: 1, assigneeId: "alice" }));
        expect(await svc.updateTaskAssignee(1, "bob")).toBe(true);
        expect((await svc.getTask(1))?.assigneeId).toBe("bob");
    });

    it("updateTaskAssignee returns false for a missing task", async () => {
        expect(await svc.updateTaskAssignee(999, "bob")).toBe(false);
    });

    it("getTaskStatistics aggregates totals by status and assignee", async () => {
        await svc.batchInsertTasks([
            makeTask({ id: 1, projectId: 1, status: "open", assigneeId: "alice" }),
            makeTask({ id: 2, projectId: 1, status: "open", assigneeId: "bob" }),
            makeTask({ id: 3, projectId: 1, status: "done", assigneeId: "alice" }),
            // unassigned + null-status task: counts toward total, buckets
            // under "" for status, and is skipped in byAssignee.
            makeTask({ id: 4, projectId: 1, status: null, assigneeId: null }),
        ]);
        const stats = await svc.getTaskStatistics(1);
        expect(stats.total).toBe(4);
        expect(stats.byStatus).toEqual({ open: 2, done: 1, "": 1 });
        expect(stats.byAssignee).toEqual({ alice: 2, bob: 1 });
    });
});
