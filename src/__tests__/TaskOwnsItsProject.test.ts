/**
 * Who may change a task's project.
 *
 * Only a milestone or a ROOT task — one with no parent task. Everything
 * filed underneath belongs to the project of what it sits in and travels
 * when that moves; moved alone it kept a parent in the project it left,
 * and the destination's table nests rows under their parent, so the row
 * was invisible in both places.
 *
 * The case this exists to hold: a task living directly in a milestone.
 * It reads as `"task"` to `getTaskKind` — deliberately, because it still
 * picks a milestone and a sprint, which a sub-task does not — so the
 * first version of this rule keyed off the kind and left the project
 * picker live for exactly those rows.
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
        expect(ownsItsProject(task())).toBe(true);
    });

    it("refuses a task filed in a milestone", () => {
        // The reported bug: this one was editable.
        expect(ownsItsProject(task({ parentTaskId: MILESTONE_TASK_ID }))).toBe(false);
    });

    it("refuses a sub-task of an ordinary task", () => {
        expect(ownsItsProject(task({ parentTaskId: 20 }))).toBe(false);
    });

    it("lets a milestone change project", () => {
        // MilestonePreview synthesizes `parentTaskId: null` for the
        // milestone's own row, and the milestone endpoint is what moves
        // it — resetting the sprint on the way.
        expect(ownsItsProject(task({ isMilestone: true }))).toBe(true);
    });

    it("cannot be derived from the task's kind", () => {
        // Both of these are `"task"`, and only one may move. Keying the
        // lock off the kind is what let a milestone's task change
        // project on its own.
        const inMilestone = task({ parentTaskId: MILESTONE_TASK_ID });
        const root = task();
        expect(getTaskKind(inMilestone, allTasks)).toBe("task");
        expect(getTaskKind(root, allTasks)).toBe("task");
        expect(ownsItsProject(inMilestone)).toBe(false);
        expect(ownsItsProject(root)).toBe(true);
    });
});
