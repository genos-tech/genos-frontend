/**
 * MIP-1042: who can be converted to a milestone, and what the table's rows look
 * like after a conversion either way. The parent/child tree is never touched
 * (Ken's rule): only the row's kind and milestone link change, and the rows below
 * it follow with the milestone and no sprint.
 */
import { describe, expect, it } from "vitest";

import {
    applyConversionToRows,
    canConvertTaskToMilestone,
} from "../features/tasks/utils/taskMilestoneConversion";
import { TaskTableProps } from "../types/tasks";

describe("canConvertTaskToMilestone", () => {
    it("is true for a saved root task", () => {
        expect(canConvertTaskToMilestone({ id: 7, parentTaskId: null, milestoneId: null })).toBe(
            true
        );
        expect(
            canConvertTaskToMilestone({ id: "7", parentTaskId: "", milestoneId: undefined })
        ).toBe(true);
        // The table caches an absent parent as the TEXT "null" in older rows (MIP-943).
        expect(canConvertTaskToMilestone({ id: 7, parentTaskId: "null" })).toBe(true);
    });

    it("is false for a sub-task", () => {
        expect(canConvertTaskToMilestone({ id: 7, parentTaskId: 3 })).toBe(false);
        expect(canConvertTaskToMilestone({ id: 7, parentTaskId: "3" })).toBe(false);
    });

    it("is false for a task inside a milestone", () => {
        expect(canConvertTaskToMilestone({ id: 7, parentTaskId: null, milestoneId: 5 })).toBe(
            false
        );
    });

    it("is false for a milestone, and for something not saved yet", () => {
        expect(canConvertTaskToMilestone({ id: 7, isMilestone: true })).toBe(false);
        expect(canConvertTaskToMilestone({ parentTaskId: null })).toBe(false);
        expect(canConvertTaskToMilestone({ id: "", parentTaskId: null })).toBe(false);
        expect(canConvertTaskToMilestone(null)).toBe(false);
        expect(canConvertTaskToMilestone(undefined)).toBe(false);
    });
});

const row = (id: number, over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({
        id: String(id),
        title: `Task ${id}`,
        parentTaskId: null,
        rootTaskId: id,
        milestoneId: null,
        sprintId: null,
        isMilestone: false,
        status: "Open",
        ...over,
    }) as unknown as TaskTableProps;

// 10 (root) -> 11 -> 12 ;  10 -> 13 ;  20 (another tree)
const tree = () => [
    row(10),
    row(11, { parentTaskId: "10", rootTaskId: 10 }),
    row(12, { parentTaskId: "11", rootTaskId: 10 }),
    row(13, { parentTaskId: "10", rootTaskId: 10 }),
    row(20),
];
const byId = (rows: TaskTableProps[], id: number) => rows.find((r) => r.id === String(id))!;

describe("applyConversionToRows: task -> milestone", () => {
    const after = { isMilestone: true, milestoneId: 99 };

    it("turns the row into a milestone and files everything below it under it", () => {
        const out = applyConversionToRows(tree(), 10, after);

        expect(byId(out, 10)).toMatchObject({
            isMilestone: true,
            milestoneId: 99,
            sprintId: null,
        });
        for (const id of [11, 12, 13]) {
            expect(byId(out, id), `task ${id}`).toMatchObject({ milestoneId: 99, sprintId: null });
            expect(byId(out, id).isMilestone).toBe(false);
        }
    });

    it("leaves the tree exactly as it was: parents and roots", () => {
        const before = tree();
        const out = applyConversionToRows(before, 10, after);

        expect(out.map((r) => r.parentTaskId)).toEqual(before.map((r) => r.parentTaskId));
        expect(out.map((r) => r.rootTaskId)).toEqual(before.map((r) => r.rootTaskId));
    });

    it("does not touch a row outside the tree (same object)", () => {
        const before = tree();
        const out = applyConversionToRows(before, 10, after);
        expect(byId(out, 20)).toBe(byId(before, 20));
    });
});

describe("applyConversionToRows: milestone -> task", () => {
    const asMilestone = () =>
        applyConversionToRows(tree(), 10, { isMilestone: true, milestoneId: 99 }).map((r) =>
            r.id === "10" ? { ...r, sprintId: 4 } : r
        );

    it("turns the row back into a task and takes the milestone and sprint off its tasks", () => {
        const out = applyConversionToRows(asMilestone(), 10, {
            isMilestone: false,
            milestoneId: null,
        });

        expect(byId(out, 10)).toMatchObject({
            isMilestone: false,
            milestoneId: null,
            sprintId: null,
        });
        for (const id of [11, 12, 13]) {
            expect(byId(out, id), `task ${id}`).toMatchObject({
                milestoneId: null,
                sprintId: null,
            });
        }
    });

    it("keeps the tasks as sub-tasks of the same row", () => {
        const before = asMilestone();
        const out = applyConversionToRows(before, 10, { isMilestone: false, milestoneId: null });

        expect(out.map((r) => r.parentTaskId)).toEqual(before.map((r) => r.parentTaskId));
        expect(byId(out, 11).parentTaskId).toBe("10");
        expect(byId(out, 12).parentTaskId).toBe("11");
    });

    it("round-trips: task -> milestone -> task gives back the original rows", () => {
        const original = tree();
        const there = applyConversionToRows(original, 10, { isMilestone: true, milestoneId: 99 });
        const back = applyConversionToRows(there, 10, { isMilestone: false, milestoneId: null });
        expect(back).toEqual(original);
    });
});

describe("applyConversionToRows: edge cases", () => {
    it("returns the same list when the row isn't in it", () => {
        const rows = tree();
        expect(applyConversionToRows(rows, 999, { isMilestone: true, milestoneId: 1 })).toBe(rows);
    });

    it("works on a root with no sub-tasks", () => {
        const out = applyConversionToRows([row(30)], 30, { isMilestone: true, milestoneId: 7 });
        expect(out[0]).toMatchObject({ isMilestone: true, milestoneId: 7 });
    });
});
