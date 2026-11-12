/**
 * Opening the diagram from a sub-task must draw the whole hierarchy.
 *
 * The diagram BFS's DOWN from a single root, so whatever it anchors on
 * decides what the user sees. Callers hand it the task the user opened —
 * often a leaf — and the loader is responsible for walking up
 * `parentTaskId` to the top of the chain.
 *
 * It deliberately does NOT trust the stored `rootTaskId` column: that
 * value is denormalized server-side, and a row whose ancestor moved
 * between milestones can still be carrying the root it had before the
 * move. Anchoring on it showed a tree the task had already left — or,
 * when the column was null, the lone leaf and nothing else, which is the
 * bug this pins.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";

import { TaskTableProps } from "../types/tasks";

// The project's rows, as the browser's synced copy hands them over (MIP-1416:
// the diagram reads the same copy as the task table). `{ tasks }` to keep the
// cases below readable.
const projectRows = vi.fn();
const loadTaskDependenciesForTasks = vi.fn();

vi.mock("../features/tasks/services/loadProjectTasks", () => ({
    loadProjectTasks: async () => [],
}));
vi.mock("../features/tasks/services/popSpecificProjectTasks", () => ({
    popSpecificProjectTasks: async () =>
        ((await projectRows()) as { tasks?: unknown[] })?.tasks ?? [],
}));
vi.mock("../features/tasks/services/loadProjectTasksFromApi", () => ({
    loadProjectTasksFromApi: async () => undefined,
}));
vi.mock("../features/tasks/services/loadTaskDependencies", () => ({
    loadTaskDependenciesBatched: async (...args: unknown[]) => {
        const byTask = await loadTaskDependenciesForTasks(...args);
        return byTask === undefined ? undefined : { byTask, failedIds: [] };
    },
}));

const { loadTaskGraph } = await import("../features/tasks/diagram/services/loadTaskGraph");

/** Only the fields the graph walk reads matter; the rest is filler. */
const task = (
    id: number,
    parentTaskId: number | null,
    extra: Partial<TaskTableProps> = {}
): TaskTableProps =>
    ({
        id: String(id),
        title: `t${id}`,
        status: "Open",
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        rootTaskId: null,
        priority: null,
        effortLevel: null,
        createdDate: null,
        updatedAt: null,
        dueDate: null,
        startDate: null,
        daysLeft: null,
        assigneeId: null,
        assigneeEmail: null,
        assigneeName: null,
        assigneeImgPath: null,
        threadId: null,
        tags: [],
        concatTags: null,
        teamId: null,
        projectId: 1,
        isMilestone: false,
        milestoneId: null,
        sprintId: null,
        ...extra,
    }) as TaskTableProps;

const myself = { userId: 1, teamId: 1 } as never;

/** Milestone 1 → task 2 → sub-task 3 → sub-sub-task 4, plus a sibling. */
const CHAIN = [
    task(1, null, { isMilestone: true, milestoneId: 10 }),
    task(2, 1, { milestoneId: 10 }),
    task(3, 2, { milestoneId: 10 }),
    task(4, 3, { milestoneId: 10 }),
    task(5, 2, { milestoneId: 10 }),
];

const idsIn = (tasks: TaskTableProps[]): number[] =>
    tasks.map((t) => Number(t.id)).sort((a, b) => a - b);

describe("loadTaskGraph anchor resolution", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadTaskDependenciesForTasks.mockResolvedValue({});
        projectRows.mockResolvedValue({ tasks: CHAIN });
    });

    it("THE BUG: a deep sub-task draws its milestone, parent and siblings — not itself alone", async () => {
        // Anchor on task 4, two levels below the task that owns it.
        const graph = await loadTaskGraph(myself, 1, 4, null);

        expect(graph).not.toBeNull();
        expect(graph!.rootTaskId).toBe(1);
        expect(idsIn(graph!.tasks)).toEqual([1, 2, 3, 4, 5]);
    });

    it("resolves the chain top from any depth", async () => {
        for (const anchor of [1, 2, 3, 4, 5]) {
            const graph = await loadTaskGraph(myself, 1, anchor, null);
            expect(graph!.rootTaskId).toBe(1);
        }
    });

    it("ignores a stale stored rootTaskId and uses the live parent chain", async () => {
        // The shape left behind by a milestone move that didn't cascade:
        // every row still claims milestone 99's backing task as its root
        // while the parent edges say otherwise. The walk must believe the
        // edges.
        projectRows.mockResolvedValue({
            tasks: [
                task(1, null, { isMilestone: true, milestoneId: 10 }),
                task(2, 1, { rootTaskId: 99 }),
                task(3, 2, { rootTaskId: 99 }),
            ],
        });

        const graph = await loadTaskGraph(myself, 1, 3, null);

        expect(graph!.rootTaskId).toBe(1);
        expect(idsIn(graph!.tasks)).toEqual([1, 2, 3]);
    });

    it("anchors on the highest row it can actually load", async () => {
        // Parent 7 isn't in the project's task list (deleted, or living in
        // another project). Task 6 is then the top of the visible chain —
        // better than returning nothing.
        projectRows.mockResolvedValue({
            tasks: [task(6, 7), task(8, 6)],
        });

        const graph = await loadTaskGraph(myself, 1, 8, null);

        expect(graph!.rootTaskId).toBe(6);
        expect(idsIn(graph!.tasks)).toEqual([6, 8]);
    });

    it("terminates on a malformed parent cycle", async () => {
        // 20 ↔ 21 claim each other as parent. The walk has to stop rather
        // than spin, and still produce a usable graph.
        projectRows.mockResolvedValue({
            tasks: [task(20, 21), task(21, 20)],
        });

        const graph = await loadTaskGraph(myself, 1, 20, null);

        expect(graph).not.toBeNull();
        expect([20, 21]).toContain(graph!.rootTaskId);
    });

    it("returns null when the anchor isn't in the project at all", async () => {
        const graph = await loadTaskGraph(myself, 1, 404, null);

        expect(graph).toBeNull();
    });

    it("asks for dependencies of the whole resolved tree, not just the anchor", async () => {
        // Ghost blockers are only drawn for tasks in the visible set, so a
        // leaf anchor previously fetched deps for one id.
        await loadTaskGraph(myself, 1, 4, null);

        const [requestedIds] = loadTaskDependenciesForTasks.mock.calls[0] as [number[]];
        expect([...requestedIds].sort((a, b) => a - b)).toEqual([1, 2, 3, 4, 5]);
    });
});

/**
 * Scope "task" (MIP-1094): the graph of ONE task and its subtasks, opened from a
 * nested table row. It must not climb to the milestone or draw the siblings.
 */
describe("loadTaskGraph scope", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        loadTaskDependenciesForTasks.mockResolvedValue({});
        projectRows.mockResolvedValue({ tasks: CHAIN });
    });

    it("draws the anchor and its subtasks only: no milestone, no parent, no siblings", async () => {
        const graph = await loadTaskGraph(myself, 1, 2, null, "task");

        expect(graph!.rootTaskId).toBe(2);
        expect(idsIn(graph!.tasks)).toEqual([2, 3, 4, 5]);
    });

    it("roots a deeper task at itself", async () => {
        const graph = await loadTaskGraph(myself, 1, 3, null, "task");

        expect(graph!.rootTaskId).toBe(3);
        expect(idsIn(graph!.tasks)).toEqual([3, 4]);
    });

    it("a task without subtasks is a graph of itself", async () => {
        const graph = await loadTaskGraph(myself, 1, 4, null, "task");

        expect(graph!.rootTaskId).toBe(4);
        expect(idsIn(graph!.tasks)).toEqual([4]);
    });

    it("the default scope is still the whole tree", async () => {
        const graph = await loadTaskGraph(myself, 1, 3, null);

        expect(graph!.rootTaskId).toBe(1);
        expect(idsIn(graph!.tasks)).toEqual([1, 2, 3, 4, 5]);
    });

    it("looks up dependencies for the subtree only", async () => {
        await loadTaskGraph(myself, 1, 3, null, "task");

        const [requestedIds] = loadTaskDependenciesForTasks.mock.calls[0] as [number[]];
        expect([...requestedIds].sort((a, b) => a - b)).toEqual([3, 4]);
    });

    it("returns null when the anchor isn't in the project", async () => {
        expect(await loadTaskGraph(myself, 1, 404, null, "task")).toBeNull();
    });

    it("a sibling that blocks a subtask comes back as a ghost, with its edge", async () => {
        // Task 5 is outside task 3's subtree but blocks task 4 inside it.
        loadTaskDependenciesForTasks.mockResolvedValue({
            4: {
                blocking: [],
                blockedBy: [
                    {
                        dependencyId: 77,
                        otherTaskId: 5,
                        displayId: "PRJ-5",
                        title: "t5",
                        status: { status: "Open" },
                        assigneeUserId: null,
                        projectId: 1,
                        projectName: "P",
                        isMilestone: false,
                    },
                ],
            },
        });

        const graph = await loadTaskGraph(myself, 1, 3, null, "task");

        expect(graph!.externalTasks.map((t) => Number(t.id))).toEqual([5]);
        expect(graph!.dependencyEdges).toEqual([
            expect.objectContaining({ dependencyId: 77, blockerTaskId: 5, blockedTaskId: 4 }),
        ]);
    });
});
