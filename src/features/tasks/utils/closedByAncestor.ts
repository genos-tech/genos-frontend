import { TaskTableProps } from "../../../types/tasks";
import { isFinishedStatus } from "../meta/taskStatuses";

/**
 * "A Closed, Rejected or Deleted parent takes everything under it with it" (MIP-1382, MIP-1389).
 *
 * The ancestor's status wins over its children's: once a milestone or a task is
 * Closed (or Deleted), whatever is below it reads as Closed (or Deleted) however
 * its own row is set, because nobody updates every status by hand. The rows are
 * not rewritten; this is a read-side rule, so reopening the ancestor brings the
 * children back exactly as they were. A row's own Closed or Rejected is kept under a Closed or
 * Rejected ancestor (MIP-2494): done work under a rejected parent stays done.
 *
 * Set-based, so a surface that holds the whole list asks once and then looks rows
 * up by id. Ancestors are reached through `parentTaskId` or through `milestoneId`
 * to the milestone's backing row (a milestone's tasks do not always point at its
 * row). Cycle-safe, and a parent that is not loaded ends the walk. This is the ONE
 * implementation of the rule: the task graph asks it too (MIP-1398; it used to have a
 * per-row copy over `parentTaskId` alone, `taskAncestry.ts`).
 */

export type VerdictStatus = "Closed" | "Rejected" | "Deleted";

export type AncestorVerdict<T = TaskTableProps> = {
    /** "Deleted" when some ancestor is Deleted (it beats the others), else "Closed" or
     *  "Rejected". */
    status: VerdictStatus;
    /** The nearest ancestor that decided it (the nearest Closed or Rejected one). */
    ancestor: T;
};

type Ancestry = Pick<TaskTableProps, "id" | "status" | "parentTaskId" | "milestoneId"> & {
    isMilestone?: boolean | null;
};

const is = (task: Pick<TaskTableProps, "status"> | undefined, wanted: string): boolean =>
    (task?.status ?? "").toLowerCase() === wanted;

/**
 * `{ rowId -> verdict }` for the rows that sit under a Closed, Rejected or Deleted ancestor,
 * at any depth. A row is in the map only if something ABOVE it says so: its own status is never
 * the reason.
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
    // One walk up per row, with its own `seen` set. The row itself starts in it, so its
    // own status is never the reason, not even through a self-parent or a loop in the
    // links; a node reached twice (parent link and milestone link) is looked at once; a
    // parent that is not loaded ends that branch.
    //
    // It is a plain walk and not a memoised recursion on purpose: a memo filled while a
    // loop guard cut the walk short remembers a half answer. With a Closed task inside a
    // loop, the loop's other members got "not under anything" or "Closed" depending on
    // which row was asked first.
    //
    // Order is the rule: ancestors are visited nearest first (a parent before what is
    // above it, the parent link before the milestone link). The first Deleted wins
    // outright (it beats Closed); otherwise the first Closed is named.
    const verdictOf = (id: string): Verdict => {
        const start = byId.get(id);
        if (start == null) return null;
        const seen = new Set<string>([id]);
        const stack = parentsOf(start).reverse();
        let closed: Verdict = null;
        while (stack.length > 0) {
            const parentId = stack.pop() as string;
            if (seen.has(parentId)) continue;
            seen.add(parentId);
            const parent = byId.get(parentId);
            if (parent == null) continue;
            if (is(parent, "deleted")) return { status: "Deleted", ancestor: parent };
            if (closed == null && is(parent, "closed")) {
                closed = { status: "Closed", ancestor: parent };
            } else if (closed == null && is(parent, "rejected")) {
                closed = { status: "Rejected", ancestor: parent };
            }
            // Push the farther link first so the nearer one is popped first.
            stack.push(...parentsOf(parent).reverse());
        }
        return closed;
    };

    const result = new Map<string, AncestorVerdict<T>>();
    for (const id of byId.keys()) {
        const verdict = verdictOf(id);
        if (verdict != null) result.set(id, verdict);
    }
    return result;
};

/**
 * The status a row should be read with: its own, unless a finished ancestor overrides it.
 * `verdicts` comes from `selectAncestorVerdicts` over the same list.
 */
export const effectiveStatusOf = (
    task: Pick<TaskTableProps, "id" | "status">,
    verdicts: ReadonlyMap<string, { status: VerdictStatus }>
): string | null | undefined => {
    const verdict = task.id != null ? verdicts.get(String(task.id))?.status : undefined;
    if (verdict == null) return task.status;
    if (verdict !== "Deleted" && (isFinishedStatus(task.status) || task.status === "Deleted")) {
        return task.status;
    }
    return verdict;
};

/** Some ancestor, at any depth, is Closed, Rejected or Deleted. `verdicts` is `selectAncestorVerdicts`
 *  over the same list. A task's own status is not an ancestor's. */
export const isUnderClosedAncestor = (
    task: Pick<TaskTableProps, "id">,
    verdicts: ReadonlyMap<string, unknown>
): boolean => task.id != null && verdicts.has(String(task.id));

/** Some ancestor, at any depth, is Deleted (a Closed or Rejected one does not count). */
export const isUnderDeletedAncestor = (
    task: Pick<TaskTableProps, "id">,
    verdicts: ReadonlyMap<string, { status: VerdictStatus }>
): boolean => task.id != null && verdicts.get(String(task.id))?.status === "Deleted";
