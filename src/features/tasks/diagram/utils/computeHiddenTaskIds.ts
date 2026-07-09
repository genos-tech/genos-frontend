import { TaskTableProps } from "../../../../types/tasks";

const statusLower = (t: TaskTableProps): string => (t.status ?? "").toLowerCase();
const isDeleted = (t: TaskTableProps): boolean => statusLower(t) === "deleted";
const isClosed = (t: TaskTableProps): boolean => statusLower(t) === "closed";

/**
 * Which internal task ids the diagram should hide, given the `hideClosed`
 * toggle. Pure + exported so the collapse behavior is unit-tested (see
 * `DiagramHiddenTasks.test.ts`).
 *
 * Always hidden: Deleted rows — soft-deleted tasks the rest of the app
 * never exposes (table / sidebar / search), regardless of the toggle.
 *
 * When `hideClosed` is on, closing a parent collapses its WHOLE branch: a
 * Closed task (other than the root) is hidden together with its entire
 * subtree — every descendant, INCLUDING still-open ones. This matches how
 * the toggle is actually used: a parent is often marked Closed while some
 * children are still open, and "hide closed" is meant to tuck that whole
 * finished branch out of the way. Turning the toggle off ("show closed
 * tasks") brings every task back.
 *
 * The root (the task the diagram was opened from) is always shown and
 * never collapses its own subtree — you opened it specifically to look at
 * its tree, so hiding everything under it would leave a useless near-empty
 * canvas. Closed branches *below* the root still collapse.
 *
 * Because a Closed parent's descendants are hidden along with it, hiding
 * closed work never leaves an open subtask dangling as a detached node.
 * (Pre-existing exception, unchanged: a Deleted task mid-path is always
 * force-hidden and can't collapse its subtree, so its open descendant
 * falls back to a root-level node.)
 */
export const computeHiddenTaskIds = (
    tasks: TaskTableProps[],
    rootTaskId: number,
    hideClosed: boolean
): Set<number> => {
    const hidden = new Set<number>();

    // Deleted rows are always hidden, regardless of the toggle.
    for (const t of tasks) {
        if (t.id != null && isDeleted(t)) hidden.add(Number(t.id));
    }
    if (!hideClosed) return hidden;

    // Adjacency: parent id -> child ids, over ALL tasks so the collapse
    // walk can reach every descendant of a closed branch.
    const childrenByParent = new Map<number, number[]>();
    for (const t of tasks) {
        if (t.id == null) continue;
        const parentId = t.parentTaskId == null ? null : Number(t.parentTaskId);
        if (parentId == null) continue;
        const bucket = childrenByParent.get(parentId) ?? [];
        bucket.push(Number(t.id));
        childrenByParent.set(parentId, bucket);
    }

    // Seed with every Closed non-root task, then walk down to collapse its
    // whole subtree (descendants hidden regardless of their own status).
    // `collapsed` doubles as the visited guard so a malformed parent cycle
    // can't spin. The root is never collapsed (guarded in the walk too, in
    // case it is a child of a collapsed node via a stale parent ref).
    const collapsed = new Set<number>();
    const stack: number[] = [];
    for (const t of tasks) {
        if (t.id == null) continue;
        const id = Number(t.id);
        if (id !== rootTaskId && isClosed(t)) stack.push(id);
    }
    while (stack.length > 0) {
        const id = stack.pop() as number;
        if (id === rootTaskId || collapsed.has(id)) continue;
        collapsed.add(id);
        for (const childId of childrenByParent.get(id) ?? []) stack.push(childId);
    }
    for (const id of collapsed) hidden.add(id);
    return hidden;
};
