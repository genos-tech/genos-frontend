import { describe, expect, it } from "vitest";

import {
    indexTasksById,
    isUnderClosedAncestor,
    isUnderDeletedAncestor,
} from "../features/tasks/utils/taskAncestry";

const row = (id: number, status: string, parentTaskId: number | null) => ({
    id: String(id),
    status,
    parentTaskId: parentTaskId == null ? null : String(parentTaskId),
});

const check = (rows: ReturnType<typeof row>[], id: number) => {
    const byId = indexTasksById(rows);
    const task = byId.get(String(id))!;
    return {
        closed: isUnderClosedAncestor(task, byId),
        deleted: isUnderDeletedAncestor(task, byId),
    };
};

describe("taskAncestry (MIP-1382)", () => {
    it("a task is under a Closed ancestor at any depth, whatever its own status", () => {
        const rows = [
            row(1, "Closed", null),
            row(2, "Open", 1),
            row(3, "WIP", 2),
            row(4, "Open", 3),
        ];
        expect(check(rows, 2).closed).toBe(true);
        expect(check(rows, 4).closed).toBe(true);
    });

    it("the root and a task with only open ancestors are not under anything", () => {
        const rows = [row(1, "Open", null), row(2, "Open", 1), row(3, "Closed", 2)];
        expect(check(rows, 1).closed).toBe(false);
        expect(check(rows, 2).closed).toBe(false);
        // Its own status is not an ancestor's: a Closed leaf is not "under" a Closed ancestor.
        expect(check(rows, 3).closed).toBe(false);
    });

    it("a Deleted ancestor counts as closed, and is the only thing the deleted check sees", () => {
        const rows = [
            row(1, "Deleted", null),
            row(2, "Open", 1),
            row(3, "Closed", null),
            row(4, "Open", 3),
        ];
        expect(check(rows, 2)).toEqual({ closed: true, deleted: true });
        expect(check(rows, 4)).toEqual({ closed: true, deleted: false });
    });

    it("is case-insensitive about the status text", () => {
        const rows = [row(1, "closed", null), row(2, "Open", 1)];
        expect(check(rows, 2).closed).toBe(true);
    });

    it("stops at a parent that is not in the list", () => {
        const rows = [row(2, "Open", 99)];
        expect(check(rows, 2)).toEqual({ closed: false, deleted: false });
    });

    it("terminates on a cycle in the parent links, and a self-parent is not its own ancestor", () => {
        const loop = [row(1, "Open", 2), row(2, "Open", 1)];
        expect(check(loop, 1).closed).toBe(false);
        const self = [row(1, "Closed", 1)];
        expect(check(self, 1).closed).toBe(false);
    });

    it("accepts numeric ids and parent ids", () => {
        const rows = [
            { id: 1, status: "Closed", parentTaskId: null },
            { id: 2, status: "Open", parentTaskId: 1 },
        ];
        const byId = indexTasksById(rows);
        expect(isUnderClosedAncestor(rows[1], byId)).toBe(true);
    });
});
