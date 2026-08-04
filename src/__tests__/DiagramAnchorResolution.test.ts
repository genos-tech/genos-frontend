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

const loadProjectTasksFromApi = vi.fn();
const loadTaskDependenciesForTasks = vi.fn();

vi.mock("../features/tasks/services/loadProjectTasksFromApi", () => ({
    loadProjectTasksFromApi: (...args: unknown[]) => loadProjectTasksFromApi(...args),
}));
vi.mock("../features/tasks/services/loadTaskDependencies", () => ({
    loadTaskDependenciesForTasks: (...args: unknown[]) => loadTaskDependenciesForTasks(...args),
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
        loadProjectTasksFromApi.mockResolvedValue({ tasks: CHAIN });
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
        loadProjectTasksFromApi.mockResolvedValue({
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
        loadProjectTasksFromApi.mockResolvedValue({
            tasks: [task(6, 7), task(8, 6)],
        });

        const graph = await loadTaskGraph(myself, 1, 8, null);

        expect(graph!.rootTaskId).toBe(6);
        expect(idsIn(graph!.tasks)).toEqual([6, 8]);
    });

    it("terminates on a malformed parent cycle", async () => {
        // 20 ↔ 21 claim each other as parent. The walk has to stop rather
        // than spin, and still produce a usable graph.
        loadProjectTasksFromApi.mockResolvedValue({
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
