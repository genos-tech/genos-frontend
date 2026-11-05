import { describe, expect, it } from "vitest";

import { applyMilestonePick } from "../features/tasks/utils/applyMilestonePick";

const task = { id: 42, title: "Ship it", milestoneId: 3, parentTaskId: 7, sprintId: 5 };

describe("applyMilestonePick (MIP-1035)", () => {
    it("writes the milestone, its backing task as the parent, and the sprint", () => {
        expect(applyMilestonePick(task, 4, 8, 9)).toEqual({
            ...task,
            milestoneId: 4,
            parentTaskId: 8,
            sprintId: 9,
        });
    });

    it("writes a null sprint: a milestone without one leaves the task with none", () => {
        expect(applyMilestonePick(task, 4, 8, null).sprintId).toBeNull();
    });

    it("clearing the milestone clears all three", () => {
        const cleared = applyMilestonePick(task, null, null, null);
        expect([cleared.milestoneId, cleared.parentTaskId, cleared.sprintId]).toEqual([
            null,
            null,
            null,
        ]);
    });

    it("leaves every other field alone and does not mutate its input", () => {
        const out = applyMilestonePick(task, 4, 8, 9);
        expect(out.title).toBe("Ship it");
        expect(out.id).toBe(42);
        expect(task.sprintId).toBe(5);
    });
});
