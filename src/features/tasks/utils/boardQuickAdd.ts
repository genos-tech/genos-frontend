import { TaskTableProps } from "../../../types/tasks";

/**
 * The milestone the board is looking at, when exactly one: the sidebar
 * folder wins, else a lone pick in the filter dropdown. With several picked
 * (or none) there is nothing to choose between, so a quick-added task is
 * created as a plain root task.
 */
export const pickScopedMilestoneId = (
    sidebarMilestoneId: number | null,
    dropdownMilestoneIds: number[]
): number | null =>
    sidebarMilestoneId ?? (dropdownMilestoneIds.length === 1 ? dropdownMilestoneIds[0] : null);

/**
 * The row a quick-added task is created under. Inside a milestone a task is
 * a child of the milestone's backing task row, which is how both the board
 * and the table find a milestone's tasks. Null (a root task) when nothing is
 * scoped, or when the backing row isn't loaded.
 */
export const quickAddParentFor = (
    allTasks: TaskTableProps[],
    scopedMilestoneId: number | null
): TaskTableProps | null =>
    scopedMilestoneId == null
        ? null
        : (allTasks.find(
              (task) => task.isMilestone === true && task.milestoneId === scopedMilestoneId
          ) ?? null);
