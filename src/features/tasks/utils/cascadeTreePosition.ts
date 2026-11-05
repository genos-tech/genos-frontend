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
// Mirrors the backend's `resolve_root_task_id` depth limit.
const MAX_ROOT_WALK = 64;

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
 * The top of the parent chain a task sits in, given the parent edge it is
 * ABOUT to have. Client-side twin of the server's `resolve_root_task_id`
 * (task_reparent.py), including its two fallbacks: a parent that isn't in
 * `tasks` anchors on the task itself, and a cycle in bad data anchors where it
 * is found instead of spinning.
 *
 * The preview's milestone picker is the caller that needs it: it hands over the
 * new milestone and the milestone's backing task as the parent, but never a
 * root (the server re-derives it), so the moved row would otherwise keep the
 * root of the place it came from.
 */
export const resolveRootTaskId = (
    tasks: TreeRow[],
    taskId: string | number,
    parentTaskId: string | number | null | undefined
): number => {
    const selfKey = key(taskId);
    let current = key(parentTaskId);
    if (selfKey == null || current == null) return Number(taskId);

    const parentOf = new Map<string, string | null>();
    for (const task of tasks) {
        const id = key(task.id);
        if (id != null) parentOf.set(id, key(task.parentTaskId));
    }

    const visited = new Set<string>([selfKey]);
    for (let depth = 0; depth < MAX_ROOT_WALK; depth++) {
        if (visited.has(current)) return Number(current);
        visited.add(current);
        if (!parentOf.has(current)) return Number(taskId);
        const next: string | null = parentOf.get(current) ?? null;
        if (next == null) return Number(current);
        current = next;
    }
    return Number(current);
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
