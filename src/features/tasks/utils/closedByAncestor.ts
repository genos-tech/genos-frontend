import { TaskTableProps } from "../../../types/tasks";

/**
 * "A closed parent closes everything under it."
 *
 * The parent's status wins over its children's: once a milestone or a task
 * is Closed, whatever is below it reads as Closed however its own row is
 * set. The rows are not rewritten; this is a read-side rule, so reopening
 * the parent brings the children back exactly as they were.
 *
 * Returns the ids of the rows with a Closed ancestor (any depth), reached
 * through `parentTaskId` or through `milestoneId` to the milestone's backing
 * row. A Closed row is only in the set if something above it is Closed too.
 */
export const selectClosedByAncestor = (allTasks: readonly TaskTableProps[]): Set<string> => {
    const byId = new Map<string, TaskTableProps>();
    const milestoneRowIds = new Map<number, string>();
    for (const task of allTasks) {
        if (task.id == null) continue;
        byId.set(String(task.id), task);
        if (task.isMilestone === true && task.milestoneId != null) {
            milestoneRowIds.set(task.milestoneId, String(task.id));
        }
    }

    const parentsOf = (task: TaskTableProps): string[] => {
        const parents: string[] = [];
        if (task.parentTaskId != null) parents.push(String(task.parentTaskId));
        if (task.isMilestone !== true && task.milestoneId != null) {
            const backing = milestoneRowIds.get(task.milestoneId);
            if (backing != null) parents.push(backing);
        }
        return parents;
    };

    // Memoised walk up. `visiting` guards against a cycle in the parent links:
    // a row already on the path answers false rather than recursing for ever.
    const memo = new Map<string, boolean>();
    const visiting = new Set<string>();
    const hasClosedAncestor = (id: string): boolean => {
        const known = memo.get(id);
        if (known !== undefined) return known;
        if (visiting.has(id)) return false;
        visiting.add(id);
        const task = byId.get(id);
        const closed =
            task != null &&
            parentsOf(task).some(
                (parentId) =>
                    byId.get(parentId)?.status === "Closed" || hasClosedAncestor(parentId)
            );
        visiting.delete(id);
        memo.set(id, closed);
        return closed;
    };

    const result = new Set<string>();
    for (const id of byId.keys()) {
        if (hasClosedAncestor(id)) result.add(id);
    }
    return result;
};
