import { describe, expect, it } from "vitest";

import {
    buildNodesAndEdges,
    computeOverview,
} from "../features/tasks/diagram/components/TaskFlowCanvas";
import type { TaskGraph } from "../features/tasks/diagram/types";
import {
    computeAnchoredExternalIds,
    computeHiddenTaskIds,
} from "../features/tasks/diagram/utils/computeHiddenTaskIds";
import { TaskTableProps } from "../types/tasks";

// Minimal TaskTableProps factory — only the fields computeHiddenTaskIds
// reads (id, status, parentTaskId) matter; the rest are filler so the
// object type-checks.
const task = (id: number, status: string, parentTaskId: number | null): TaskTableProps =>
    ({
        id: String(id),
        title: `t${id}`,
        status,
        parentTaskId: parentTaskId == null ? null : String(parentTaskId),
        priority: null,
        effortLevel: null,
        createdDate: null,
        updatedAt: null,
        dueDate: null,
        daysLeft: null,
        assigneeId: null,
        assigneeEmail: null,
        assigneeName: null,
        assigneeImgPath: null,
        rootTaskId: null,
        threadId: null,
        tags: [],
        concatTags: null,
        teamId: null,
        projectId: 1,
    }) as TaskTableProps;

const hidden = (tasks: TaskTableProps[], root: number, hideClosed: boolean): number[] =>
    [...computeHiddenTaskIds(tasks, root, hideClosed)].sort((a, b) => a - b);

describe("computeHiddenTaskIds", () => {
    it("hideClosed off: hides only Deleted rows", () => {
        const tasks = [task(1, "Open", null), task(2, "Closed", 1), task(3, "Deleted", 1)];
        expect(hidden(tasks, 1, false)).toEqual([3]);
    });

    it("THE NAMED CASE: closing a parent collapses its whole branch — an open child is hidden along with its Closed parent", () => {
        // root(open) -> A(closed) -> A1(open). Closing A hides A AND its
        // still-open child A1 (the whole finished branch tucks away).
        const tasks = [task(1, "Open", null), task(2, "Closed", 1), task(3, "Open", 2)];
        expect(hidden(tasks, 1, true)).toEqual([2, 3]);
    });

    it("collapses a whole branch under a Closed node, open descendants at any depth included", () => {
        // root(open) -> A(closed) -> B(open) -> C(open). All of A/B/C hide.
        const tasks = [
            task(1, "Open", null),
            task(2, "Closed", 1),
            task(3, "Open", 2),
            task(4, "Open", 3),
        ];
        expect(hidden(tasks, 1, true)).toEqual([2, 3, 4]);
    });

    it("only collapses the closed branch, leaving sibling open work visible", () => {
        // root(open) -> A(closed) -> A1(open); root -> B(open).
        const tasks = [
            task(1, "Open", null),
            task(2, "Closed", 1),
            task(3, "Open", 2),
            task(4, "Open", 1),
        ];
        expect(hidden(tasks, 1, true)).toEqual([2, 3]);
    });

    it("hides a closed leaf", () => {
        const tasks = [task(1, "Open", null), task(2, "Closed", 1), task(3, "Open", 1)];
        expect(hidden(tasks, 1, true)).toEqual([2]);
    });

    it("hideClosed off shows the whole closed branch again", () => {
        // Same tree as the named case; toggle off => nothing closed hidden.
        const tasks = [task(1, "Open", null), task(2, "Closed", 1), task(3, "Open", 2)];
        expect(hidden(tasks, 1, false)).toEqual([]);
    });

    it("root is always shown and does NOT collapse its own subtree when the root itself is Closed", () => {
        // Diagram opened from a Closed milestone/task: you opened it to see
        // its tree, so an open child stays visible. A Closed branch BELOW
        // the root still collapses.
        const openChild = [task(1, "Closed", null), task(2, "Open", 1)];
        expect(hidden(openChild, 1, true)).toEqual([]);

        // root(closed) -> A(closed) -> B(open): A is a closed NON-root, so
        // its branch collapses; the root still shows.
        const closedBranch = [task(1, "Closed", null), task(2, "Closed", 1), task(3, "Open", 2)];
        expect(hidden(closedBranch, 1, true)).toEqual([2, 3]);
    });

    it("Deleted is always hidden; a sibling fully-closed branch collapses too", () => {
        const tasks = [task(1, "Open", null), task(2, "Deleted", 1), task(3, "Closed", 1)];
        expect(hidden(tasks, 1, true)).toEqual([2, 3]);
    });

    it("a Deleted parent takes its children with it, whatever their status, toggle or not (MIP-1382)", () => {
        // root(open) -> A(deleted) -> B(open) -> C(wip). No sub-task floats on as a
        // root-level card once its parent is gone.
        const tasks = [
            task(1, "Open", null),
            task(2, "Deleted", 1),
            task(3, "Open", 2),
            task(4, "WIP", 3),
            task(5, "Open", 1),
        ];
        expect(hidden(tasks, 1, true)).toEqual([2, 3, 4]);
        expect(hidden(tasks, 1, false)).toEqual([2, 3, 4]);
    });

    it("a Closed parent's children stay visible with the toggle off", () => {
        const tasks = [task(1, "Open", null), task(2, "Closed", 1), task(3, "Open", 2)];
        expect(hidden(tasks, 1, false)).toEqual([]);
    });

    it("is resilient to a malformed parent cycle (no infinite loop)", () => {
        // A(closed) <-> B(closed) reference each other as parents; both are
        // closed non-root seeds so both collapse — the walk must terminate.
        const tasks = [task(1, "Open", null), task(2, "Closed", 3), task(3, "Closed", 2)];
        expect(hidden(tasks, 1, true)).toEqual([2, 3]);
    });
});

/**
 * Ghost (external) blocker cards follow the tasks they were drawn for.
 *
 * A ghost is synthesised from a dependency on an internal task, so once
 * every internal task it relates to is hidden it has nothing to say.
 * Before this, hiding a closed task dropped its dependency EDGES but left
 * the blocker CARD stranded on the canvas with no line to anything.
 */
describe("computeAnchoredExternalIds", () => {
    // 10, 11 = internal; 90, 91 = ghosts in another project.
    const edges = [
        // ghost 90 blocks internal 10
        { blockerTaskId: 90, blockedTaskId: 10 },
        // internal 11 blocks ghost 91
        { blockerTaskId: 11, blockedTaskId: 91 },
    ];
    const anchored = (visible: number[]): number[] =>
        [...computeAnchoredExternalIds(edges, new Set(visible))]
            .filter((id) => id >= 90)
            .sort((a, b) => a - b);

    it("keeps a ghost whose blocked task is still visible", () => {
        expect(anchored([10, 11])).toEqual([90, 91]);
    });

    it("drops a ghost once the task it blocks is hidden", () => {
        // The closed-task case: 10 collapsed away, so its blocker goes.
        expect(anchored([11])).toEqual([91]);
    });

    it("drops a ghost that a hidden task was blocking", () => {
        // Anchoring counts both directions, so this side hides too.
        expect(anchored([10])).toEqual([90]);
    });

    it("drops every ghost when the whole tree is hidden", () => {
        expect(anchored([])).toEqual([]);
    });

    it("keeps a ghost anchored by any one of several tasks", () => {
        // Shared blocker: still relevant while ONE dependent is visible.
        const shared = [
            { blockerTaskId: 90, blockedTaskId: 10 },
            { blockerTaskId: 90, blockedTaskId: 11 },
        ];
        const ids = [...computeAnchoredExternalIds(shared, new Set([11]))];
        expect(ids).toContain(90);
    });

    it("drops ghost-to-ghost edges, which anchor nothing", () => {
        const ghostOnly = [{ blockerTaskId: 90, blockedTaskId: 91 }];
        expect([...computeAnchoredExternalIds(ghostOnly, new Set([10]))]).toEqual([]);
    });
});

/**
 * End-to-end through the node builder: what the user actually sees on
 * the canvas when a task in the milestone is closed.
 *
 * Tree: root 1 (Open) with children 2 (Closed) and 3 (Open). Task 2 is
 * blocked by external ghost 90; task 3 by ghost 91. With "hide closed"
 * on, BOTH task 2 and ghost 90 should be gone — before this, the edge
 * vanished but ghost 90 stayed on the canvas as a stranded card.
 */
describe("buildNodesAndEdges — closed tasks take their blockers with them", () => {
    const ghost = (id: number, status: string): TaskTableProps =>
        ({ ...task(id, status, null), projectId: 99 }) as TaskTableProps;

    const graph: TaskGraph = {
        rootTaskId: 1,
        tasks: [task(1, "Open", null), task(2, "Closed", 1), task(3, "Open", 1)],
        externalTasks: [ghost(90, "Open"), ghost(91, "Open")],
        dependencyEdges: [
            { dependencyId: 1, blockerTaskId: 90, blockedTaskId: 2, otherStatus: null },
            { dependencyId: 2, blockerTaskId: 91, blockedTaskId: 3, otherStatus: null },
        ],
    } as unknown as TaskGraph;

    const nodeIdsWith = (hideClosed: boolean): number[] =>
        buildNodesAndEdges(
            graph,
            null,
            new Map(),
            new Map(),
            null,
            {
                onChange: () => undefined,
                onAddSubtask: () => undefined,
                onDelete: () => undefined,
                onOpenPreview: () => undefined,
            },
            hideClosed,
            null
        )
            .nodes.map((n) => Number(n.id))
            .sort((a, b) => a - b);

    it("hides the closed task AND the ghost that only blocked it", () => {
        // 2 (closed) and 90 (its blocker) both gone; 91 stays because
        // the task IT blocks is still open.
        expect(nodeIdsWith(true)).toEqual([1, 3, 91]);
    });

    it("brings both back when closed tasks are shown", () => {
        expect(nodeIdsWith(false)).toEqual([1, 2, 3, 90, 91]);
    });

    it("drops the dependency edge along with its endpoints", () => {
        const { edges } = buildNodesAndEdges(
            graph,
            null,
            new Map(),
            new Map(),
            null,
            {
                onChange: () => undefined,
                onAddSubtask: () => undefined,
                onDelete: () => undefined,
                onOpenPreview: () => undefined,
            },
            true,
            null
        );
        expect(edges.some((e) => e.id === "d-1")).toBe(false);
        expect(edges.some((e) => e.id === "d-2")).toBe(true);
    });
});

/**
 * MIP-1382: the header overview and the cards' progress treat everything under a Closed
 * task as Closed, and drop everything under a Deleted one, however those rows are set.
 */
describe("graph figures under a Closed / Deleted ancestor", () => {
    // root -> A(closed) -> A1(open, overdue) ; root -> B(open) ; root -> D(deleted) -> D1(open)
    const rows = [
        task(1, "Open", null),
        { ...task(2, "Closed", 1), dueDate: "2000-01-01" },
        { ...task(3, "Open", 2), dueDate: "2000-01-01" },
        { ...task(4, "Open", 1), dueDate: "2000-01-01" },
        task(5, "Deleted", 1),
        task(6, "Open", 5),
    ];
    const graph = {
        rootTaskId: 1,
        tasks: rows,
        externalTasks: [],
        dependencyEdges: [],
    } as unknown as TaskGraph;

    it("overview: the open child of a Closed task counts as closed and is not overdue", () => {
        const o = computeOverview(graph, new Map(), new Map());
        // 2 (closed), 3 (under closed), 4 (open) live; 5 and 6 are gone.
        expect(o.total).toBe(3);
        expect(o.closed).toBe(2);
        // Only B is overdue: A1 sits under a Closed task, A is Closed.
        expect(o.overdueCount).toBe(1);
    });

    it("cards: the root's progress badge agrees with the overview", () => {
        const { nodes } = buildNodesAndEdges(
            graph,
            null,
            new Map(),
            new Map(),
            null,
            {
                onChange: () => undefined,
                onAddSubtask: () => undefined,
                onDelete: () => undefined,
                onOpenPreview: () => undefined,
            },
            false,
            null
        );
        const root = nodes.find((n) => n.id === "1")?.data as {
            closedDescendantCount: number;
            totalDescendantCount: number;
        };
        expect(root.totalDescendantCount).toBe(3);
        expect(root.closedDescendantCount).toBe(2);
        // The Deleted branch is not drawn at all, even with closed tasks shown.
        expect(nodes.map((n) => n.id).sort()).toEqual(["1", "2", "3", "4"]);
    });
});
