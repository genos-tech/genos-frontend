import { TaskTableProps } from "../../../types/tasks";
import type { TaskGraph } from "../diagram/types";

/**
 * A task delete waits behind an Undo toast (MIP-1303, `useDeleteTask`). While it
 * waits, every list must already show the task as deleted, but the server must
 * not hear about it yet (the real write also adds activity rows, un-blocks the
 * tasks that depended on it and rewrites the PM card, and no restore call takes
 * those back).
 *
 * The pending key lives in the undo module's hidden set (`useUndoHidden`). This
 * file turns that set into the one thing the lists read: the rows with the
 * pending tasks' status overlaid as "Deleted". An overlay and not a removal, so
 * the window shows exactly what the commit will leave behind: a child of a
 * Deleted parent nests differently from a child of an ABSENT one in the table,
 * and the dashboard walks the parent chain looking for a Deleted ancestor.
 */

const PREFIX = "task:";

/** The undo key of a pending task delete (a milestone's backing task counts). */
export const taskDeleteKey = (taskId: number | string): string => `${PREFIX}${taskId}`;

/** True while the delete of `taskId` waits behind its Undo toast. */
export const isTaskDeletePending = (hidden: ReadonlySet<string>, taskId: number | string) =>
    hidden.has(taskDeleteKey(taskId));

/**
 * The rows with every pending delete shown as Deleted. The SAME array when
 * nothing applies (no pending key, or only keys of other kinds such as a
 * comment's, or a pending task that is not in these rows): a new identity
 * re-runs the filter pipeline, the table's tree indexes and the board.
 */
export const overlayPendingDeletes = (
    rows: TaskTableProps[],
    hidden: ReadonlySet<string>
): TaskTableProps[] => {
    if (hidden.size === 0) return rows;
    const pending = new Set<string>();
    for (const key of hidden) {
        if (key.startsWith(PREFIX)) pending.add(key.slice(PREFIX.length));
    }
    if (pending.size === 0) return rows;
    let changed = false;
    const next = rows.map((row) => {
        if (row.id == null || !pending.has(String(row.id)) || row.status === "Deleted") return row;
        changed = true;
        return { ...row, status: "Deleted" };
    });
    return changed ? next : rows;
};

/** The ids of the tasks whose delete is pending, as one stable string: a re-layout
 *  that depends on it runs when a delete starts or ends and not for any other key. */
export const pendingDeleteSignature = (hidden: ReadonlySet<string>): string =>
    [...hidden]
        .filter((key) => key.startsWith(PREFIX))
        .sort()
        .join(",");

/**
 * The task graph (the diagram keeps its own copy of the rows, loaded from the graph
 * endpoint) with every pending delete shown as Deleted, so a card leaves the canvas
 * when its toast opens and comes back on Undo. The same object when nothing applies.
 */
export const overlayGraphDeletes = (graph: TaskGraph, hidden: ReadonlySet<string>): TaskGraph => {
    const tasks = overlayPendingDeletes(graph.tasks, hidden);
    const externalTasks = overlayPendingDeletes(graph.externalTasks, hidden);
    return tasks === graph.tasks && externalTasks === graph.externalTasks
        ? graph
        : { ...graph, tasks, externalTasks };
};
