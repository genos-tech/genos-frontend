import { TaskProps, TaskTableProps } from "../../../types/tasks";

// What "shape" a task is — used by the create form to choose what UI
// to show, and by the preview pane to label / branch on the current
// task. Wider than `useTM.isCreatingTask.creationKind` (which only
// stores the user's `"task" | "milestone"` toggle) because we also
// distinguish a sub-task: a child of a regular (non-milestone) task.
//
// `CreationKind` is kept as an alias so the create-form call site can
// keep reading more naturally; both names resolve to the same union.
export type TaskKind = "task" | "milestone" | "subtask";
export type CreationKind = TaskKind;

export type IsCreatingTaskState = {
    parentTaskId: number | null;
    milestoneId: number | null;
    creationKind: "task" | "milestone";
};

// Look up `parentTaskId` in the project's task table to decide whether
// the parent is a milestone backing task. `allTasks[].id` is a string
// (matches the table's row-id convention), hence the Number cast.
const isParentMilestone = (parentTaskId: number | null, allTasks: TaskTableProps[]): boolean =>
    parentTaskId != null &&
    allTasks.some((t) => t.id != null && Number(t.id) === parentTaskId && t.isMilestone === true);

/**
 * Effective creation kind for the create form, derived from the
 * persisted `useTM.isCreatingTask` state plus the project's task table.
 *
 *   - "subtask":   parentTaskId is set AND that parent is NOT a milestone.
 *                  Sprint/milestone are inherited from the parent chain
 *                  and the picker is hidden.
 *   - "task":      a top-level task, OR a task created directly inside
 *                  a milestone (parent IS the milestone backing task).
 *   - "milestone": top-level milestone create. Forced off whenever the
 *                  form is opened inside a milestone or beneath any
 *                  parent task (milestones can't nest under either).
 */
export const getCreationKind = (
    isCreatingTask: IsCreatingTaskState,
    allTasks: TaskTableProps[]
): CreationKind => {
    if (
        isCreatingTask.parentTaskId != null &&
        !isParentMilestone(isCreatingTask.parentTaskId, allTasks)
    ) {
        return "subtask";
    }
    if (isCreatingTask.milestoneId != null || isCreatingTask.parentTaskId != null) {
        return "task";
    }
    return isCreatingTask.creationKind === "milestone" ? "milestone" : "task";
};

/**
 * Kind of an *existing* task — useful for the preview pane and any
 * downstream UI that needs to branch on whether the current task is a
 * milestone, a regular task, or a sub-task.
 *
 *   - "milestone": this task is the backing task of a milestone
 *                  (`isMilestone === true`).
 *   - "subtask":   has a parent task AND that parent is NOT a milestone.
 *   - "task":      everything else — top-level task, or a task that
 *                  lives directly under a milestone.
 *
 * Returns `undefined` when `task` is undefined so callers can early-out
 * without dancing around an extra null check.
 */
export const getTaskKind = (
    task: TaskProps | undefined,
    allTasks: TaskTableProps[]
): TaskKind | undefined => {
    if (!task) return undefined;
    if (task.isMilestone === true) return "milestone";
    if (task.parentTaskId != null && !isParentMilestone(task.parentTaskId, allTasks)) {
        return "subtask";
    }
    return "task";
};

/**
 * Does this task decide its own project, or follow something above it?
 *
 * Only a milestone or a ROOT task — one with no parent task — decides.
 * Everything else belongs to the project of what it is filed under, and
 * that includes a task living directly in a milestone: those hang off the
 * milestone's backing row, so the milestone owns which project they are
 * in and they travel when IT moves. Moving one alone left it pointing at
 * a parent in the project it came from, and the destination's table nests
 * rows under their parent, so the row went missing from both. The server
 * enforces the same rule (`task_views._is_nested_task`).
 *
 * Not expressible as a `TaskKind`: a milestone's own task is "task" there
 * and must stay that way, since it still picks a milestone and a sprint.
 * A milestone reads as owning its project — `MilestonePreview` synthesizes
 * `parentTaskId: null` — and moves through the milestone endpoint, which
 * also resets the sprint.
 */
export const ownsItsProject = (task: Pick<TaskProps, "parentTaskId">): boolean =>
    task.parentTaskId == null;
