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

    it("THE NAMED CASE: a Closed parent with an open child stays visible (kept as connector) and the child is never hidden", () => {
        // root(open) -> A(closed) -> A1(open)
        const tasks = [task(1, "Open", null), task(2, "Closed", 1), task(3, "Open", 2)];
        const h = computeHiddenTaskIds(tasks, 1, true);
        // The closed parent is KEPT (connector) so the open child stays
        // attached to the tree instead of detaching.
        expect(h.has(2)).toBe(false);
        expect(h.has(3)).toBe(false);
        expect(h.size).toBe(0);
    });

    it("hides a fully-closed branch (closed parent whose descendants are all closed)", () => {
        // root(open) -> A(closed) -> A1(closed)
        const tasks = [task(1, "Open", null), task(2, "Closed", 1), task(3, "Closed", 2)];
        expect(hidden(tasks, 1, true)).toEqual([2, 3]);
    });

    it("hides a closed leaf", () => {
        const tasks = [task(1, "Open", null), task(2, "Closed", 1), task(3, "Open", 1)];
        expect(hidden(tasks, 1, true)).toEqual([2]);
    });

    it("keeps a deep chain of closed connectors above open work", () => {
        // root(open) -> A(closed) -> B(closed) -> C(open)
        const tasks = [
            task(1, "Open", null),
            task(2, "Closed", 1),
            task(3, "Closed", 2),
            task(4, "Open", 3),
        ];
        expect(hidden(tasks, 1, true)).toEqual([]);
    });

    it("never hides the root even when the root itself is Closed", () => {
        // Diagram opened from a Closed milestone/task.
        const tasks = [task(1, "Closed", null), task(2, "Open", 1)];
        expect(hidden(tasks, 1, true)).toEqual([]);
    });

    it("Deleted is always hidden; a sibling fully-closed branch collapses too", () => {
        const tasks = [task(1, "Open", null), task(2, "Deleted", 1), task(3, "Closed", 1)];
        expect(hidden(tasks, 1, true)).toEqual([2, 3]);
    });

    it("documents the pre-existing Deleted-mid-path caveat: Deleted parent hidden, its open child not hidden (will detach)", () => {
        // root(open) -> A(deleted) -> B(open). B stays visible but its
        // parent A is force-hidden, so B falls back to a root-level node.
        // This is unchanged, pre-existing behavior (Deleted can't be a
        // connector); asserted so a future change is a conscious one.
        const tasks = [task(1, "Open", null), task(2, "Deleted", 1), task(3, "Open", 2)];
        const h = computeHiddenTaskIds(tasks, 1, true);
        expect(h.has(2)).toBe(true);
        expect(h.has(3)).toBe(false);
    });

    it("is resilient to a malformed parent cycle (no infinite loop)", () => {
        // A(closed) <-> B(closed) reference each other; neither reaches an
        // open task, so both hide — but the walk must terminate.
        const tasks = [task(1, "Open", null), task(2, "Closed", 3), task(3, "Closed", 2)];
        expect(hidden(tasks, 1, true)).toEqual([2, 3]);
    });
});
