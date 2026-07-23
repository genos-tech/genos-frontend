import { describe, expect, it } from "vitest";

import { selectMilestonesWithMatchingChildren } from "../features/tasks/utils/milestoneChildFilter";
import { TaskTableProps } from "../types/tasks";

// Picking a milestone sets the task's `parentTaskId` to that milestone's
// backing task (`TaskMainBlock.onChangeMilestone`), so a milestone's
// DIRECT children are exactly its tasks, and anything deeper is a
// sub-task of a task.
const row = (id: string, over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({ id, parentTaskId: null, isMilestone: false, ...over }) as TaskTableProps;

const milestone = (id: string) => row(id, { isMilestone: true });
const taskUnder = (id: string, parentTaskId: string) => row(id, { parentTaskId });

describe("selectMilestonesWithMatchingChildren", () => {
    it("finds the milestone whose task matched", () => {
        // The reported case: milestone-A has no tag, task-a has "DEV".
        // Filtering by DEV must still surface milestone-A.
        const tasks = [milestone("A"), taskUnder("a", "A")];
        expect([...selectMilestonesWithMatchingChildren(tasks, new Set(["a"]))]).toEqual(["A"]);
    });

    it("returns nothing when no child matched", () => {
        const tasks = [milestone("A"), taskUnder("a", "A")];
        expect(selectMilestonesWithMatchingChildren(tasks, new Set()).size).toBe(0);
    });

    it("ignores a matching SUB-task, since depth is one level", () => {
        // sub under task-a under milestone-A. `sub` matching must NOT
        // rescue milestone-A — its parent is a task, not a milestone.
        const tasks = [milestone("A"), taskUnder("a", "A"), taskUnder("sub", "a")];
        expect(selectMilestonesWithMatchingChildren(tasks, new Set(["sub"])).size).toBe(0);
    });

    it("still rescues the milestone when the direct task ALSO has a matching sub-task", () => {
        const tasks = [milestone("A"), taskUnder("a", "A"), taskUnder("sub", "a")];
        const result = selectMilestonesWithMatchingChildren(tasks, new Set(["a", "sub"]));
        expect([...result]).toEqual(["A"]);
    });

    it("ignores a matching child whose parent is a plain root task", () => {
        // Root task R with child c: a matching `c` must not put R in the
        // set — the rescue is milestone-only.
        const tasks = [row("R"), taskUnder("c", "R")];
        expect(selectMilestonesWithMatchingChildren(tasks, new Set(["c"])).size).toBe(0);
    });

    it("handles several milestones independently", () => {
        const tasks = [
            milestone("A"),
            taskUnder("a", "A"),
            milestone("B"),
            taskUnder("b", "B"),
            milestone("C"),
            taskUnder("c", "C"),
        ];
        const result = selectMilestonesWithMatchingChildren(tasks, new Set(["a", "c"]));
        expect([...result].sort()).toEqual(["A", "C"]);
    });

    it("reports a milestone once even when several of its tasks match", () => {
        const tasks = [milestone("A"), taskUnder("a1", "A"), taskUnder("a2", "A")];
        const result = selectMilestonesWithMatchingChildren(tasks, new Set(["a1", "a2"]));
        expect([...result]).toEqual(["A"]);
    });

    it("tolerates null ids and orphaned parent links", () => {
        const tasks = [
            milestone("A"),
            row(null as unknown as string, { parentTaskId: "A" }),
            taskUnder("orphan", "does-not-exist"),
        ];
        expect(() =>
            selectMilestonesWithMatchingChildren(tasks, new Set(["orphan"]))
        ).not.toThrow();
        expect(selectMilestonesWithMatchingChildren(tasks, new Set(["orphan"])).size).toBe(0);
    });

    it("compares ids as strings, so a numeric parentTaskId still matches", () => {
        // `allTasks` rows arrive with numeric ids on some paths.
        const tasks = [milestone("7"), row("a", { parentTaskId: 7 as unknown as string })];
        expect([...selectMilestonesWithMatchingChildren(tasks, new Set(["a"]))]).toEqual(["7"]);
    });
});
