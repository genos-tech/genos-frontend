/**
 * Client-side mirror of the server's sub-tree cascade.
 *
 * Moving a task to another milestone moves everything beneath it, and the
 * API does exactly that (`_cascade_tree_position_to_subtasks`). The
 * optimistic paths, though, replace only the row the user dragged — so
 * until something forces a full project reload, the descendants in local
 * state still claim the milestone and the chain root they had before the
 * move. Milestone-scoped views filter on precisely those fields, so the
 * sub-tasks of a just-moved task drop out of view under their own parent.
 *
 * Applying the same move locally keeps the optimistic state honest. The
 * server remains the source of truth; this only avoids showing a wrong
 * intermediate state while the request is in flight (and after it, since
 * the task PUT doesn't trigger a project refetch).
 */

// Both `TaskTableProps` (ids as strings) and `TaskProps` (ids as numbers)
// flow through here, so the shape is structural and id comparison is
// string-based.
type TreeRow = {
    id?: string | number | null;
    parentTaskId?: string | number | null;
};

export type TreePosition = {
    milestoneId: number | null;
    sprintId: number | null;
    rootTaskId: number | null;
};

// Mirrors the backend's cascade depth cap.
const MAX_DEPTH = 10;

const key = (value: string | number | null | undefined): string | null =>
    value == null || value === "" ? null : String(value);

/**
 * Every descendant of `movedTaskId` in `tasks`, by BFS over
 * `parentTaskId`. The moved task itself is excluded — callers have
 * already built its updated row.
 */
export const collectDescendantIds = (
    tasks: TreeRow[],
    movedTaskId: string | number
): Set<string> => {
    const childrenByParent = new Map<string, string[]>();
    for (const task of tasks) {
        const id = key(task.id);
        const parentId = key(task.parentTaskId);
        if (id == null || parentId == null) continue;
        const bucket = childrenByParent.get(parentId) ?? [];
        bucket.push(id);
        childrenByParent.set(parentId, bucket);
    }

    const movedKey = key(movedTaskId);
    if (movedKey == null) return new Set();

    const descendants = new Set<string>();
    let frontier = [movedKey];
    for (let depth = 0; depth < MAX_DEPTH && frontier.length > 0; depth++) {
        const next: string[] = [];
        for (const parentId of frontier) {
            for (const childId of childrenByParent.get(parentId) ?? []) {
                // Guards both a diamond and a corrupt parent cycle.
                if (childId === movedKey || descendants.has(childId)) continue;
                descendants.add(childId);
                next.push(childId);
            }
        }
        frontier = next;
    }
    return descendants;
};

/**
 * Return `tasks` with `position` applied to every descendant of
 * `movedTaskId`. Parent edges are left alone: the edges *inside* the
 * moved sub-tree don't change when its top moves.
 *
 * Returns the original array when there's nothing below the moved task,
 * so callers can pass this straight to a state setter without forcing a
 * re-render for the common leaf case.
 */
export const applyTreePositionToDescendants = <T extends TreeRow>(
    tasks: T[],
    movedTaskId: string | number,
    position: TreePosition
): T[] => {
    const descendants = collectDescendantIds(tasks, movedTaskId);
    if (descendants.size === 0) return tasks;
    return tasks.map((task) => {
        const id = key(task.id);
        if (id == null || !descendants.has(id)) return task;
        return {
            ...task,
            milestoneId: position.milestoneId,
            sprintId: position.sprintId,
            rootTaskId: position.rootTaskId,
        };
    });
};
