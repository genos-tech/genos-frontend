import { TaskTableProps } from "../../../types/tasks";
import { applyTreePositionToDescendants } from "./cascadeTreePosition";

/**
 * Converting a task to a milestone and back (MIP-1042): who may be converted,
 * and what the table's rows look like afterwards.
 */

type Convertible = {
    id?: number | string | null;
    parentTaskId?: number | string | null;
    milestoneId?: number | null;
    isMilestone?: boolean | null;
};

const hasValue = (v: number | string | null | undefined): boolean =>
    v !== null && v !== undefined && v !== "" && v !== "null";

/** Only a ROOT task becomes a milestone: no parent, not in a milestone, not one
 *  already. A sub-task, or a task inside a milestone, has a place in a tree
 *  that a conversion would have to change. The server refuses the rest too. */
export const canConvertTaskToMilestone = (task: Convertible | null | undefined): boolean =>
    !!task &&
    hasValue(task.id) &&
    task.isMilestone !== true &&
    !hasValue(task.parentTaskId) &&
    !hasValue(task.milestoneId);

/**
 * The table's rows after a task became a milestone, or a milestone a task. The
 * row changes its kind and milestone link; everything below it follows with the
 * new milestone and no sprint. The parent edges and roots are untouched, as on
 * the server.
 */
export const applyConversionToRows = (
    rows: TaskTableProps[],
    taskId: number,
    after: { isMilestone: boolean; milestoneId: number | null }
): TaskTableProps[] => {
    const key = String(taskId);
    const row = rows.find((r) => String(r.id) === key);
    if (!row) return rows;
    const withRow = rows.map((r) =>
        String(r.id) === key
            ? {
                  ...r,
                  isMilestone: after.isMilestone,
                  milestoneId: after.milestoneId,
                  sprintId: null,
              }
            : r
    );
    return applyTreePositionToDescendants(withRow, key, {
        milestoneId: after.milestoneId,
        sprintId: null,
        // Nothing moved in the tree, so the chain root stays the row's own.
        rootTaskId: row.rootTaskId ?? Number(taskId),
    });
};
