import { TaskTableProps } from "../../../types/tasks";

/**
 * "A closed or deleted parent takes everything under it with it" (MIP-1382).
 *
 * Users do not close every sub-task before they close the parent, so a task whose
 * parent, grandparent, ... up to the root (a milestone's backing row included) is
 * Closed or Deleted has to be treated as Closed / Deleted itself, whatever its own
 * status says. The rows are never rewritten: this is a read-side rule, and reopening
 * the ancestor brings the children back exactly as they were.
 *
 * Pure and keyed on `parentTaskId` only, so any surface that holds a list of rows can
 * adopt it. (`selectClosedByAncestor` is the same idea for the table: it also follows
 * `milestoneId` and returns every affected id at once, but ignores Deleted.)
 */

type Ancestry = Pick<TaskTableProps, "status" | "parentTaskId">;

/** Rows by id, keyed by the string id every `TaskTableProps` carries. */
export const indexTasksById = <T extends Ancestry & { id?: string | number | null }>(
    tasks: readonly T[]
): Map<string, T> => {
    const byId = new Map<string, T>();
    for (const task of tasks) {
        if (task.id != null) byId.set(String(task.id), task);
    }
    return byId;
};

const statusIs = (task: Ancestry, wanted: "closed" | "deleted"): boolean =>
    (task.status ?? "").toLowerCase() === wanted;

/**
 * True when some ancestor of `task` satisfies `match`. Walks `parentTaskId` through
 * `byId` to the top, stops at a parent that is not in `byId`, and answers false on a
 * cycle in the links instead of spinning. The task's own status is never looked at.
 */
const hasAncestor = (
    task: Ancestry & { id?: string | number | null },
    byId: ReadonlyMap<string, Ancestry>,
    match: (ancestor: Ancestry) => boolean
): boolean => {
    const seen = new Set<string>();
    if (task.id != null) seen.add(String(task.id));
    let parentId = task.parentTaskId;
    while (parentId != null) {
        const key = String(parentId);
        if (seen.has(key)) return false;
        seen.add(key);
        const parent = byId.get(key);
        if (!parent) return false;
        if (match(parent)) return true;
        parentId = parent.parentTaskId;
    }
    return false;
};

/** Some ancestor, at any depth, is Closed or Deleted. */
export const isUnderClosedAncestor = (
    task: Ancestry & { id?: string | number | null },
    byId: ReadonlyMap<string, Ancestry>
): boolean => hasAncestor(task, byId, (a) => statusIs(a, "closed") || statusIs(a, "deleted"));

/** Some ancestor, at any depth, is Deleted (a Closed one does not count). */
export const isUnderDeletedAncestor = (
    task: Ancestry & { id?: string | number | null },
    byId: ReadonlyMap<string, Ancestry>
): boolean => hasAncestor(task, byId, (a) => statusIs(a, "deleted"));
