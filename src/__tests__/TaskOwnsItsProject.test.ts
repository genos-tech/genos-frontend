/**
 * Who may change a task's project.
 *
 * A milestone, a ROOT task (no parent) and a task living DIRECTLY in a
 * milestone (MIP-786). Everything filed under an ORDINARY task belongs to that
 * task's project and travels when it moves: moved alone it would keep a parent
 * in the project it came from, and the destination's table nests rows under
 * their parent, so the row would be invisible in both places.
 *
 * The parent being a milestone is not on the task, so the rule reads the
 * project's task table; the kind alone can't tell a task in a milestone from a
 * root task (both are `"task"`).
 */
import { describe, expect, it } from "vitest";

import { getTaskKind, ownsItsProject } from "../features/tasks/utils/taskKind";
import type { TaskProps, TaskTableProps } from "../types/tasks";

const MILESTONE_TASK_ID = 10;

const tableRow = (over: Partial<TaskTableProps> = {}): TaskTableProps =>
    ({ id: "1", isMilestone: false, ...over }) as TaskTableProps;

// The project's task table as the preview pane sees it: a milestone's
// backing row, plus an ordinary task to hang sub-tasks off.
const allTasks: TaskTableProps[] = [
    tableRow({ id: String(MILESTONE_TASK_ID), isMilestone: true }),
    tableRow({ id: "20", isMilestone: false }),
];

const task = (over: Partial<TaskProps> = {}): TaskProps =>
    ({ id: 1, parentTaskId: null, ...over }) as TaskProps;

describe("ownsItsProject", () => {
    it("lets a root task change project", () => {
        expect(ownsItsProject(task(), allTasks)).toBe(true);
    });

    it("lets a task filed directly in a milestone change project", () => {
        expect(ownsItsProject(task({ parentTaskId: MILESTONE_TASK_ID }), allTasks)).toBe(true);
    });

    it("refuses a sub-task of an ordinary task", () => {
        expect(ownsItsProject(task({ parentTaskId: 20 }), allTasks)).toBe(false);
    });

    it("refuses a task whose parent is not in the table yet", () => {
        // Locked until the hierarchy can be resolved: the safe side.
        expect(ownsItsProject(task({ parentTaskId: MILESTONE_TASK_ID }), [])).toBe(false);
    });

    it("lets a milestone change project", () => {
        // MilestonePreview synthesizes `parentTaskId: null` for the
        // milestone's own row, and the milestone endpoint is what moves
        // it — resetting the sprint on the way.
        expect(ownsItsProject(task({ isMilestone: true }), allTasks)).toBe(true);
    });

    it("cannot be derived from the task's kind", () => {
        // A task in a milestone and a root task are both `"task"`; a sub-task
        // of an ordinary task is the one that stays locked.
        const inMilestone = task({ parentTaskId: MILESTONE_TASK_ID });
        const root = task();
        const sub = task({ parentTaskId: 20 });
        expect(getTaskKind(inMilestone, allTasks)).toBe("task");
        expect(getTaskKind(root, allTasks)).toBe("task");
        expect(getTaskKind(sub, allTasks)).toBe("subtask");
        expect(ownsItsProject(sub, allTasks)).toBe(false);
    });
});
