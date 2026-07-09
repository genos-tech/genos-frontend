import { TaskTableProps } from "../../../../types/tasks";

const statusLower = (t: TaskTableProps): string => (t.status ?? "").toLowerCase();
const isDeleted = (t: TaskTableProps): boolean => statusLower(t) === "deleted";
const isClosed = (t: TaskTableProps): boolean => statusLower(t) === "closed";

/**
 * Which internal task ids the diagram should hide, given the `hideClosed`
 * toggle. Pure + exported so the tricky "closed parent, open child" case
 * is unit-tested (see `DiagramHiddenTasks.test.ts`).
 *
 * Always hidden: Deleted rows — soft-deleted tasks the rest of the app
 * never exposes (table / sidebar / search), regardless of the toggle.
 *
 * When `hideClosed` is on, a Closed task is hidden ONLY if it is not the
 * root AND it has no open work anywhere in its subtree. A Closed task
 * that sits on the path from the root to an open (non-closed, non-deleted)
 * descendant is KEPT as a connector, so that still-open descendant stays
 * attached to the tree instead of floating off as a detached root-level
 * node. Concretely: `keep = root ∪ every live task and all of its
 * ancestors`; Closed tasks outside `keep` are hidden. (This is why hiding
 * closed work by default never makes an open subtask disappear or
 * detach — the exact failure mode a closed-parent/open-child tree would
 * otherwise hit.)
 *
 * Known, pre-existing limitation left as-is: a *Deleted* task mid-path
 * still detaches its open descendant, because Deleted is always force-
 * hidden and can't act as a connector. That's outside the hide-closed
 * behavior and unchanged here.
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

    const byId = new Map<number, TaskTableProps>();
    for (const t of tasks) {
        if (t.id != null) byId.set(Number(t.id), t);
    }

    // keep = root + every "live" (open, non-deleted) task and its whole
    // ancestor chain. Walking up keeps closed intermediates that connect
    // open work back toward the root. `keep.has` doubles as the visited /
    // cycle guard so a malformed parent loop can't spin.
    const keep = new Set<number>([rootTaskId]);
    const markSelfAndAncestors = (startId: number): void => {
        let cur: number | null = startId;
        while (cur != null && !keep.has(cur)) {
            keep.add(cur);
            // Explicit annotation: without it TS infers `parent`'s type
            // through the `cur = ...` reassignment below, which loops back
            // to `cur` (TS7022 circular-initializer).
            const parent: string | null | undefined = byId.get(cur)?.parentTaskId;
            cur = parent == null ? null : Number(parent);
        }
    };
    for (const t of tasks) {
        if (t.id == null || isDeleted(t) || isClosed(t)) continue;
        markSelfAndAncestors(Number(t.id));
    }

    // Hide Closed tasks that aren't needed as connectors. The root (focal
    // point) always stays; Deleted are already hidden above.
    for (const t of tasks) {
        if (t.id == null) continue;
        const id = Number(t.id);
        if (isDeleted(t) || id === rootTaskId) continue;
        if (isClosed(t) && !keep.has(id)) hidden.add(id);
    }
    return hidden;
};
