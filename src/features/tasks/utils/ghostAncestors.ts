import { TaskTableProps } from "../../../types/tasks";

/**
 * Result of walking a set of "matched" tasks up to their roots.
 *
 * Used by the task table's Member filter: `matches` are the tasks/milestones
 * assigned to the filtered member. A matching subtask whose parent ISN'T
 * assigned to that member would otherwise vanish — the tree has nothing to
 * hang it under. These are the ancestors we splice back in as dimmed,
 * non-interactive "ghost" rows so the dependency chain stays visible.
 */
export type GhostAncestors = {
    /** Ids of ancestor rows that are NOT themselves matches (render dimmed). */
    ghostIds: Set<string>;
    /** Every ancestor id of every match — the rows to force-expand so a
     *  matching descendant is actually visible (includes matching ancestors). */
    ancestorIds: Set<string>;
    /** Ghost ancestors that are top-level tasks — merged into the root list. */
    ghostRoots: TaskTableProps[];
    /** Ghost ancestors that are sub-tasks — spliced under their own parent. */
    ghostChildren: TaskTableProps[];
};

/**
 * Walk each `match` up its `parentTaskId` chain (resolving each parent from
 * `allTasks`), collecting every ancestor. Ancestors that are NOT themselves
 * matches become "ghosts". A parent that isn't present in `allTasks`
 * (cross-project / filtered-out) simply ends the walk for that branch.
 *
 * Pure and self-contained so the shapes can be unit-tested directly.
 */
export const deriveGhostAncestors = (
    matches: TaskTableProps[],
    allTasks: TaskTableProps[]
): GhostAncestors => {
    const byId = new Map<string, TaskTableProps>();
    for (const task of allTasks) {
        if (task.id != null) byId.set(String(task.id), task);
    }
    const matchedIds = new Set<string>();
    for (const t of matches) {
        if (t.id != null) matchedIds.add(String(t.id));
    }

    const ancestorIds = new Set<string>();
    const ghostTasks = new Map<string, TaskTableProps>();
    for (const match of matches) {
        let pid = match.parentTaskId != null ? String(match.parentTaskId) : null;
        const guard = new Set<string>();
        while (pid && !guard.has(pid)) {
            guard.add(pid);
            ancestorIds.add(pid);
            if (!matchedIds.has(pid)) {
                const ghost = byId.get(pid);
                if (ghost) ghostTasks.set(pid, ghost);
            }
            const parent = byId.get(pid);
            pid = parent?.parentTaskId != null ? String(parent.parentTaskId) : null;
        }
    }

    const ghostRoots: TaskTableProps[] = [];
    const ghostChildren: TaskTableProps[] = [];
    for (const g of ghostTasks.values()) {
        if (g.parentTaskId == null) ghostRoots.push(g);
        else ghostChildren.push(g);
    }
    return { ghostIds: new Set(ghostTasks.keys()), ancestorIds, ghostRoots, ghostChildren };
};
