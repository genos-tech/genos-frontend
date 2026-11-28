// Which task statuses a project's rows must be loaded for (MIP-2000).
//
// A big project is mostly Closed tasks (MIP-682: ~780 of 800). The table opens on
// the ongoing statuses, so the first load asks the server for those only
// (`getProjectTasks?statuses=...`, genos-api #1114) and the rest is fetched when a
// filter first needs it.
//
// A "scope" is the set of statuses the local store holds for one project:
// `null` is ALL of them (nothing is sent to the server: the old request), a list
// is exactly those statuses (plus the ancestors and milestone rows the server adds
// to every scoped answer). "All" is never written out as labels: the server's
// `status__in` would drop a row with a null or unknown status, and the store could
// then never match the server's count.
//
// This file is imported by the IndexedDB worker as well as the UI, so it holds
// plain functions only (no React, no i18n, no theme).

import { ACTIVE_STATUS_NAMES, STATUS_NAMES } from "../meta/taskStatuses";

export type StatusScope = readonly string[] | null;

/** The statuses the server accepts on `?statuses=` (genos-api task_status_scope.py). */
export const SERVER_STATUS_LABELS: readonly string[] = STATUS_NAMES;

/** What the table shows by default and the first load asks for: everything not finished. */
export const ACTIVE_STATUSES: readonly string[] = ACTIVE_STATUS_NAMES;

/** localStorage switch (and `VITE_TASK_STATUS_SCOPE=off` at build time): every load asks for
 *  all statuses again, exactly the behaviour before MIP-2000. */
export const STATUS_SCOPE_OFF_KEY = "genos:taskStatusScope";

export const taskStatusScopeEnabled = (): boolean => {
    try {
        if (import.meta.env?.VITE_TASK_STATUS_SCOPE === "off") return false;
    } catch {
        /* no import.meta.env (a test runner without it): fall through */
    }
    try {
        return localStorage.getItem(STATUS_SCOPE_OFF_KEY) !== "off";
    } catch {
        return true;
    }
};

/** True when a store holding `held` can show a view that needs `need`. `held` undefined
 *  (nothing is known yet) covers nothing but "no need". */
export const scopeCovers = (held: StatusScope | undefined, need: StatusScope): boolean => {
    if (held === null) return true;
    if (need === null) return false;
    if (held === undefined) return need.length === 0;
    const have = new Set(held);
    return need.every((s) => have.has(s));
};

/** The smallest scope holding both. */
export const unionScope = (a: StatusScope, b: StatusScope): StatusScope => {
    if (a === null || b === null) return null;
    const merged = new Set([...a, ...b]);
    return SERVER_STATUS_LABELS.filter((s) => merged.has(s));
};

/** A stable string for a scope (effect keys, in-flight keys). */
export const scopeKey = (scope: StatusScope | undefined): string =>
    scope === undefined ? "?" : scope === null ? "*" : [...scope].sort().join(",");

/** A row's own status is inside the scope (every row is, in an All scope). */
export const rowInScope = (scope: StatusScope, status: string | null | undefined): boolean =>
    scope === null || (status != null && scope.includes(status));

/**
 * The scope a table needs to draw its current filter.
 *
 * - "All" (or nothing selected), or a past milestone's full history: all statuses.
 * - "Expired" on its own means "every status whose due date has passed": all statuses.
 *   Next to other statuses it narrows them (status in selection AND past due), so it
 *   adds nothing to what is needed.
 * - Closed, Rejected or Deleted selected: all statuses. A task whose own status is Open but sits
 *   under a Closed parent reads as Closed (closed-by-ancestor), and the Closed filter
 *   must list it, so the children of closed tasks, whatever their status, are needed too.
 * - Otherwise exactly the selected labels (Open, WIP, Blocked, Pending).
 */
export const statusesNeeded = (input: {
    /** Labels of the selected status filters ("All", "Open", "Expired", ...). */
    labels: readonly string[];
    /** The view bypasses the status filter (a past milestone, a folder's full history). */
    showsFullHistory?: boolean;
}): StatusScope => {
    if (input.showsFullHistory) return null;
    const labels = input.labels.filter((l) => l !== "Expired");
    if (input.labels.length === 0 || input.labels.includes("All")) return null;
    if (labels.length === 0) return null;
    if (labels.some((l) => l === "Closed" || l === "Rejected" || l === "Deleted")) return null;
    const known = labels.filter((l) => SERVER_STATUS_LABELS.includes(l));
    // A label the server does not know: do not guess, load everything.
    if (known.length !== labels.length) return null;
    return unionScope(known, known);
};

/** What the first load of a project asks for: the table's stored filter (it survives a
 *  reload), else the ongoing statuses. Peeking the stored filter means a user who left
 *  the table on "Closed" does not pay for a second load at boot. */
export const initialStatusNeed = (projectId: number | string): StatusScope => {
    if (!taskStatusScopeEnabled()) return null;
    try {
        const raw = localStorage.getItem(`taskFilters:table:${projectId}`);
        if (raw) {
            const parsed: unknown = JSON.parse(raw);
            const status = (parsed as { status?: unknown } | null)?.status;
            if (Array.isArray(status) && status.every((x) => typeof x === "string")) {
                if (status.length > 0) return statusesNeeded({ labels: status as string[] });
            }
        }
    } catch {
        /* unreadable: the default */
    }
    return ACTIVE_STATUSES;
};
