import { describe, expect, it } from "vitest";

import {
    isUnderClosedAncestor,
    isUnderDeletedAncestor,
    selectAncestorVerdicts,
} from "../features/tasks/utils/closedByAncestor";

// The task graph's two questions, asked of the ONE shared rule (MIP-1398). These seven cases
// were `taskAncestry.test.ts` (MIP-1382), the graph's own per-row copy of the rule; their
// bodies are unchanged, only the way they ask is.
const row = (id: number, status: string, parentTaskId: number | null) => ({
    id: String(id),
    status,
    parentTaskId: parentTaskId == null ? null : String(parentTaskId),
});

const check = (rows: ReturnType<typeof row>[], id: number) => {
    const verdicts = selectAncestorVerdicts(rows);
    const task = rows.find((r) => String(r.id) === String(id))!;
    return {
        closed: isUnderClosedAncestor(task, verdicts),
        deleted: isUnderDeletedAncestor(task, verdicts),
    };
};

describe("the graph's ancestor questions on closedByAncestor (MIP-1382, MIP-1398)", () => {
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
        // Off-type on purpose: `parentTaskId` is declared a string, but a numeric one has
        // reached these rows, and the lookup compares through `String()`.
        const rows = [
            { id: 1, status: "Closed", parentTaskId: null },
            { id: 2, status: "Open", parentTaskId: 1 },
        ] as unknown as ReturnType<typeof row>[];
        expect(isUnderClosedAncestor(rows[1], selectAncestorVerdicts(rows))).toBe(true);
    });
});
