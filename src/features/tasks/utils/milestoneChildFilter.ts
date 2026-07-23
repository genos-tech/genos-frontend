import { TaskTableProps } from "../../../types/tasks";

/**
 * "A milestone survives the filter when one of ITS TASKS survives it."
 *
 * The filter pipeline judges every row on its own metadata, so a
 * milestone carrying no tags was dropped by a tag filter even when the
 * tasks underneath it matched — taking those matching tasks off screen
 * with it, since a task only renders beneath its milestone row. The same
 * held for status, priority, effort and member.
 *
 * Depth is deliberately ONE level. Picking a milestone sets the task's
 * `parentTaskId` to that milestone's backing task (see
 * `TaskMainBlock.onChangeMilestone`), so a milestone's direct children
 * are exactly its tasks. Sub-tasks hang off a task, not off the
 * milestone, and are out of scope by design: rescuing a milestone for
 * something three levels down would surface rows whose relationship to
 * the filter isn't visible on screen.
 */

/** Is this row a milestone's backing task? */
const isMilestoneRow = (task: TaskTableProps): boolean => task.isMilestone === true;

/**
 * Backing-task ids of the milestones that have at least one DIRECT child
 * task in `matchedIds`.
 *
 * Drives two things at the call site: which non-matching milestones to
 * re-admit, and which milestone rows to auto-expand so the matching task
 * is actually on screen rather than one click away.
 *
 * `matchedIds` is the filter pass's own set of surviving non-root rows,
 * so no predicate is re-evaluated here — this only reads the parent
 * links, which keeps the two in step by construction.
 */
export const selectMilestonesWithMatchingChildren = (
    allTasks: readonly TaskTableProps[],
    matchedIds: ReadonlySet<string>
): Set<string> => {
    const milestoneRowIds = new Set<string>();
    for (const task of allTasks) {
        if (task.id != null && isMilestoneRow(task)) milestoneRowIds.add(String(task.id));
    }

    const result = new Set<string>();
    for (const task of allTasks) {
        if (task.id == null || task.parentTaskId == null) continue;
        if (!matchedIds.has(String(task.id))) continue;
        // A matching SUB-task's parent is a regular task, so it isn't in
        // `milestoneRowIds` and is ignored — that's the one-level rule.
        const parentId = String(task.parentTaskId);
        if (milestoneRowIds.has(parentId)) result.add(parentId);
    }
    return result;
};

/**
 * Backing-task ids of the milestones the user picked in the milestone
 * filter — the only rows the table auto-expands.
 *
 * Narrowing to a milestone is a statement about wanting to see THAT
 * milestone's work, so opening it saves a click that has no other
 * purpose. Every other filter deliberately leaves rows closed: expanding
 * on, say, a tag filter fires across the whole list at once and reorders
 * what the user is reading, which is disruptive rather than helpful.
 *
 * Returns empty when the milestone filter isn't narrowing (i.e. "All"),
 * so the default view is never force-opened.
 */
export const selectMilestoneRowsForSelection = (
    allTasks: readonly TaskTableProps[],
    selectedMilestoneIds: ReadonlySet<number>
): Set<string> => {
    const result = new Set<string>();
    if (selectedMilestoneIds.size === 0) return result;
    for (const task of allTasks) {
        if (task.id == null || !isMilestoneRow(task)) continue;
        if (task.milestoneId != null && selectedMilestoneIds.has(task.milestoneId)) {
            result.add(String(task.id));
        }
    }
    return result;
};
