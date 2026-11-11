import { TaskTableProps } from "../../../types/tasks";

/**
 * "A Closed or Deleted parent takes everything under it with it" (MIP-1382, MIP-1389).
 *
 * The ancestor's status wins over its children's: once a milestone or a task is
 * Closed (or Deleted), whatever is below it reads as Closed (or Deleted) however
 * its own row is set, because nobody updates every status by hand. The rows are
 * not rewritten; this is a read-side rule, so reopening the ancestor brings the
 * children back exactly as they were.
 *
 * Set-based, so a surface that holds the whole list asks once and then looks rows
 * up by id. Ancestors are reached through `parentTaskId` or through `milestoneId`
 * to the milestone's backing row (a milestone's tasks do not always point at its
 * row). Cycle-safe, and a parent that is not loaded ends the walk. The task-graph
 * helper (`taskAncestry.ts`) is the per-row version of the same rule over
 * `parentTaskId` alone.
 */

export type AncestorVerdict<T = TaskTableProps> = {
    /** "Deleted" when some ancestor is Deleted (it beats Closed), else "Closed". */
    status: "Closed" | "Deleted";
    /** The nearest ancestor that decided it (the nearest Closed one for "Closed"). */
    ancestor: T;
};

type Ancestry = Pick<TaskTableProps, "id" | "status" | "parentTaskId" | "milestoneId"> & {
    isMilestone?: boolean | null;
};

const is = (task: Pick<TaskTableProps, "status"> | undefined, wanted: string): boolean =>
    (task?.status ?? "").toLowerCase() === wanted;

/**
 * `{ rowId -> verdict }` for the rows that sit under a Closed or Deleted ancestor,
 * at any depth. A row that is itself Closed or Deleted is in the map only if
 * something ABOVE it is too: its own status is never the reason.
 */
export const selectAncestorVerdicts = <T extends Ancestry>(
    allTasks: readonly T[]
): Map<string, AncestorVerdict<T>> => {
    const byId = new Map<string, T>();
    const milestoneRowIds = new Map<number, string>();
    for (const task of allTasks) {
        if (task.id == null) continue;
        byId.set(String(task.id), task);
        if (task.isMilestone === true && task.milestoneId != null) {
            milestoneRowIds.set(task.milestoneId, String(task.id));
        }
    }

    const parentsOf = (task: T): string[] => {
        const parents: string[] = [];
        if (task.parentTaskId != null) parents.push(String(task.parentTaskId));
        if (task.isMilestone !== true && task.milestoneId != null) {
            const backing = milestoneRowIds.get(task.milestoneId);
            if (backing != null) parents.push(backing);
        }
        return parents;
    };

    type Verdict = AncestorVerdict<T> | null;
    // Memoised walk up. `visiting` guards against a cycle in the parent links:
    // a row already on the path answers null rather than recursing for ever.
    const memo = new Map<string, Verdict>();
    const visiting = new Set<string>();
    const verdictOf = (id: string): Verdict => {
        if (memo.has(id)) return memo.get(id) ?? null;
        if (visiting.has(id)) return null;
        const task = byId.get(id);
        if (task == null) return null;
        visiting.add(id);
        let found: Verdict = null;
        // Deleted beats Closed; among equals the nearest wins (a parent before
        // what is above it, the parent link before the milestone link).
        for (const parentId of parentsOf(task)) {
            const parent = byId.get(parentId);
            if (parent == null) continue;
            const candidates: Verdict[] = [
                is(parent, "deleted")
                    ? { status: "Deleted", ancestor: parent }
                    : is(parent, "closed")
                      ? { status: "Closed", ancestor: parent }
                      : null,
                verdictOf(parentId),
            ];
            for (const candidate of candidates) {
                if (candidate == null) continue;
                if (
                    found == null ||
                    (candidate.status === "Deleted" && found.status === "Closed")
                ) {
                    found = candidate;
                }
            }
        }
        visiting.delete(id);
        memo.set(id, found);
        return found;
    };

    const result = new Map<string, AncestorVerdict<T>>();
    for (const id of byId.keys()) {
        const verdict = verdictOf(id);
        if (verdict != null) result.set(id, verdict);
    }
    return result;
};

/**
 * The status a row should be read with: its own, unless a Closed or Deleted ancestor
 * overrides it. `verdicts` comes from `selectAncestorVerdicts` over the same list.
 */
export const effectiveStatusOf = (
    task: Pick<TaskTableProps, "id" | "status">,
    verdicts: ReadonlyMap<string, { status: "Closed" | "Deleted" }>
): string | null | undefined =>
    (task.id != null ? verdicts.get(String(task.id))?.status : undefined) ?? task.status;
