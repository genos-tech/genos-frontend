import { TaskTableProps } from "../../../types/tasks";
import { effectiveStatusOf, selectAncestorVerdicts } from "./closedByAncestor";

/**
 * The table's parent id -> child rows index, before each group is sorted.
 *
 * `visibleChildTaskIds` is what the filter menu published: the ids of the children
 * that pass the active filter, so an expanded parent only reveals what matches
 * (selecting status "Open" no longer surfaces a "Closed" sub-task). While it is
 * `null` the filter pass has not run yet, so the index is built permissively to
 * avoid blanking out children on the very first render, and drops only what is
 * Deleted: the row itself, or a Deleted ancestor above it that takes its branch
 * with it (MIP-1389; the filter pass applies the same rule once it has run).
 */
export const selectChildrenByParent = (
    allTasks: readonly TaskTableProps[],
    visibleChildTaskIds: ReadonlySet<string> | null
): Map<string, TaskTableProps[]> => {
    const verdicts = visibleChildTaskIds === null ? selectAncestorVerdicts(allTasks) : null;
    const map = new Map<string, TaskTableProps[]>();
    for (const task of allTasks) {
        if (task.parentTaskId == null) continue;
        if (verdicts !== null) {
            if (effectiveStatusOf(task, verdicts) === "Deleted") continue;
        } else if (task.id == null || !visibleChildTaskIds?.has(String(task.id))) {
            continue;
        }
        const parentId = String(task.parentTaskId);
        const arr = map.get(parentId) || [];
        arr.push(task);
        map.set(parentId, arr);
    }
    return map;
};
