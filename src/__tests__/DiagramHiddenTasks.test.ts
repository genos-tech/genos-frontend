import { describe, expect, it } from "vitest";

import { computeHiddenTaskIds } from "../features/tasks/diagram/utils/computeHiddenTaskIds";
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

    it("documents the pre-existing Deleted-mid-path caveat: Deleted parent hidden, its open child not hidden (will detach)", () => {
        // root(open) -> A(deleted) -> B(open). B stays visible but its
        // parent A is force-hidden, so B falls back to a root-level node.
        // Unchanged, pre-existing behavior (Deleted always hides but can't
        // collapse its subtree); asserted so a future change is conscious.
        const tasks = [task(1, "Open", null), task(2, "Deleted", 1), task(3, "Open", 2)];
        const h = computeHiddenTaskIds(tasks, 1, true);
        expect(h.has(2)).toBe(true);
        expect(h.has(3)).toBe(false);
    });

    it("is resilient to a malformed parent cycle (no infinite loop)", () => {
        // A(closed) <-> B(closed) reference each other as parents; both are
        // closed non-root seeds so both collapse — the walk must terminate.
        const tasks = [task(1, "Open", null), task(2, "Closed", 3), task(3, "Closed", 2)];
        expect(hidden(tasks, 1, true)).toEqual([2, 3]);
    });
});
