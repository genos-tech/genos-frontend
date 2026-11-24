/**
 * The ONE place that lists the task statuses and the groupings built from them (MIP-2390,
 * phase 0 of "custom statuses and workflows", MIP-1467).
 *
 * Before this, about a dozen files each typed their own `["Open", "WIP", "Blocked", "Pending",
 * ...]`, so adding or renaming a status meant finding every copy. Colors stay in `taskTone.ts`
 * (a view over these names); this file is the list, the order and the groups.
 *
 * Pure data, no imports: safe to use from services, stores and tests.
 * `taskStatusOneSource.test.ts` fails when a new hard-coded copy appears elsewhere.
 *
 * Pure refactor: every value below is exactly what the old copies held.
 */

/** Every status the server can hold, in the table's order. */
export const STATUS_NAMES = ["Open", "WIP", "Blocked", "Pending", "Closed", "Deleted"] as const;
export type StatusName = (typeof STATUS_NAMES)[number];

/** Not finished and not gone: the "Ongoing" group. */
export const ACTIVE_STATUS_NAMES = ["Open", "WIP", "Blocked", "Pending"] as const;

/** The statuses a normal workflow uses: no tombstone. Milestones, CSV import, reports. */
export const WORKFLOW_STATUS_NAMES = ["Open", "WIP", "Blocked", "Pending", "Closed"] as const;

/** Left out of a sub-task list's first request (fetched on demand). */
export const HIDDEN_STATUS_NAMES = ["Closed", "Deleted"] as const;

export const STATUS_OPEN = "Open";
export const STATUS_WIP = "WIP";
export const STATUS_BLOCKED = "Blocked";
export const STATUS_PENDING = "Pending";
/** The status that means done. */
export const STATUS_CLOSED = "Closed";
export const STATUS_DELETED = "Deleted";

/** Table sort rank: the order of `STATUS_NAMES`, 1-based (what `sortTask` has always used). */
export const STATUS_RANK: Record<string, number> = Object.fromEntries(
    STATUS_NAMES.map((name, i) => [name, i + 1])
);

/**
 * How early a card comes among its siblings on the diagram: active work first. WIP, then
 * Blocked, Open and Pending; closed, deleted and anything unknown last.
 */
export const DIAGRAM_STATUS_ORDER: readonly string[] = ["WIP", "Blocked", "Open", "Pending"];

/** The "All / Ongoing / Closed / Deleted" task lists and the statuses each one shows. */
export const TASK_LIST_GROUPS = {
    all: { id: 0, statuses: [...STATUS_NAMES] as string[], name: "All" },
    ongoing: { id: 1, statuses: [...ACTIVE_STATUS_NAMES] as string[], name: "Ongoing" },
    closed: { id: 2, statuses: [STATUS_CLOSED] as string[], name: "Closed" },
    deleted: { id: 3, statuses: [STATUS_DELETED] as string[], name: "Deleted" },
};

/** A fresh copy each call, for callers that mutate or hold the object in state. */
export const buildTaskListGroups = () => ({
    all: { ...TASK_LIST_GROUPS.all, statuses: [...TASK_LIST_GROUPS.all.statuses] },
    ongoing: { ...TASK_LIST_GROUPS.ongoing, statuses: [...TASK_LIST_GROUPS.ongoing.statuses] },
    closed: { ...TASK_LIST_GROUPS.closed, statuses: [...TASK_LIST_GROUPS.closed.statuses] },
    deleted: { ...TASK_LIST_GROUPS.deleted, statuses: [...TASK_LIST_GROUPS.deleted.statuses] },
});
