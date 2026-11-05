/**
 * MIP-1048. The board's milestone cards take their "closed / total" from the
 * loaded task rows, because the server's `tasksClosed` is only refreshed when
 * the milestone list reloads: a task dragged to Closed left the card at its old
 * number until a reload.
 */
import { describe, expect, it } from "vitest";

import { Milestone } from "../features/tasks/sprint-milestone/types";
import { milestonesByTaskIdWithLiveProgress } from "../features/tasks/utils/boardMilestoneProgress";

const milestone = (over: Partial<Milestone> = {}): Milestone =>
    ({
        milestoneId: 7,
        taskId: 70,
        title: "Launch",
        tasksTotal: 3,
        tasksClosed: 1,
        ...over,
    }) as unknown as Milestone;

const task = (status: string, milestoneId: number | null = 7, isMilestone = false) => ({
    status,
    milestoneId,
    isMilestone,
});

describe("milestonesByTaskIdWithLiveProgress", () => {
    it("keys each milestone by its backing task's id (the board row's id)", () => {
        const map = milestonesByTaskIdWithLiveProgress([milestone()], []);
        expect(map.get(70)?.milestoneId).toBe(7);
        expect(map.has(7)).toBe(false);
    });

    it("counts a task moved to Closed at once, without a reload", () => {
        const m = milestone();
        const before = [task("Open"), task("Open"), task("Closed")];
        const after = [task("Open"), task("Closed"), task("Closed")];
        expect(milestonesByTaskIdWithLiveProgress([m], before).get(70)).toMatchObject({
            tasksClosed: 1,
            tasksTotal: 3,
        });
        expect(milestonesByTaskIdWithLiveProgress([m], after).get(70)).toMatchObject({
            tasksClosed: 2,
            tasksTotal: 3,
        });
    });

    it("counts a task added after the milestone list loaded", () => {
        const m = milestone();
        const rows = [task("Open"), task("Open"), task("Closed"), task("Open")];
        expect(milestonesByTaskIdWithLiveProgress([m], rows).get(70)).toMatchObject({
            tasksClosed: 1,
            tasksTotal: 4,
        });
    });

    it("leaves Deleted tasks out, like the server count", () => {
        const rows = [task("Open"), task("Closed"), task("Deleted")];
        expect(milestonesByTaskIdWithLiveProgress([milestone()], rows).get(70)).toMatchObject({
            tasksClosed: 1,
            tasksTotal: 2,
        });
    });

    it("never counts the milestone's own backing row", () => {
        const rows = [task("Closed", 7, true), task("Open"), task("Closed")];
        expect(milestonesByTaskIdWithLiveProgress([milestone()], rows).get(70)).toMatchObject({
            tasksClosed: 1,
            tasksTotal: 2,
        });
    });

    it("counts each milestone's own tasks, not its neighbour's", () => {
        const map = milestonesByTaskIdWithLiveProgress(
            [
                milestone(),
                milestone({ milestoneId: 8, taskId: 80, tasksTotal: 0, tasksClosed: 0 }),
            ],
            [task("Closed", 7), task("Open", 8), task("Open", 8), task("Closed", 8)]
        );
        expect(map.get(70)).toMatchObject({ tasksClosed: 1, tasksTotal: 1 });
        expect(map.get(80)).toMatchObject({ tasksClosed: 1, tasksTotal: 3 });
    });

    it("ignores tasks that belong to no milestone", () => {
        // `Number(null)` is 0, so a milestone with id 0 would swallow them.
        const zero = milestone({ milestoneId: 0, taskId: 5, tasksTotal: 0, tasksClosed: 0 });
        const rows = [task("Open", null), task("Closed", null), task("Open")];
        const map = milestonesByTaskIdWithLiveProgress([milestone(), zero], rows);
        expect(map.get(70)).toMatchObject({ tasksTotal: 1 });
        expect(map.get(5)).toBe(zero);
    });

    it("keeps the server's numbers when none of its tasks is loaded", () => {
        // Not "0/0 done": the rows may just not be here yet.
        const m = milestone({ tasksTotal: 5, tasksClosed: 2 });
        const out = milestonesByTaskIdWithLiveProgress([m], [task("Open", 99)]).get(70);
        expect(out).toBe(m);
    });

    it("keeps the same object when the live numbers already match", () => {
        // Same identity means the memoised card does not re-render.
        const m = milestone();
        const rows = [task("Open"), task("Open"), task("Closed")];
        expect(milestonesByTaskIdWithLiveProgress([m], rows).get(70)).toBe(m);
    });

    it("does not touch the milestone it was handed", () => {
        const m = milestone();
        milestonesByTaskIdWithLiveProgress([m], [task("Closed"), task("Closed")]);
        expect(m.tasksClosed).toBe(1);
    });

    it("skips a milestone with no backing task", () => {
        const map = milestonesByTaskIdWithLiveProgress(
            [milestone({ taskId: null as unknown as number })],
            []
        );
        expect(map.size).toBe(0);
    });
});
