import { STATUS_RANK } from "./sortTask";

/**
 * Ordering for the dashboard's "Top by Weight" shortlist.
 *
 * This only decides how the panel's rows are READ — the shortlist itself is
 * always the highest-weight active tasks, which is what the panel is. Sorting
 * before the selection would silently turn it into a different panel (a
 * due-date list that happens to be titled "Top by Weight").
 *
 * The two modes mirror the My-Tasks "Up Next" list so both panels expose the
 * SAME sort options ("By weight" / "By urgency"):
 *   - "weight" (default): heaviest first, then soonest due date (undated
 *     last), then status rank (Open → WIP → Blocked → Pending).
 *   - "urgency": the deadline-first rule shared with "Up Next"
 *     (`compareByUrgency`) — overdue first, then priority, then soonest due,
 *     then most recently updated.
 */

export type TopWeightSortMode = "weight" | "urgency";

/** Priority order for the urgency rule. Shared with the "Up Next" list. */
const PRIORITY_RANK: Record<string, number> = {
    Critical: 0,
    High: 1,
    Normal: 2,
    Low: 3,
    Minimal: 4,
};

/** The task fields the two sorts read. Structural so the dashboard's richer
 *  `EffectiveTask` row satisfies it without importing it here. */
export type TopWeightTask = {
    dueDate?: string | null;
    effectiveStatus: string;
    priority?: string | null;
    updatedAt?: string | null;
};

export type TopWeightRow = {
    task: TopWeightTask;
    weight: number;
};

// ms since epoch, or null for a missing/unparseable date.
const dueTime = (dueDate: string | null | undefined): number | null => {
    if (!dueDate) return null;
    const ms = new Date(dueDate).getTime();
    return Number.isNaN(ms) ? null : ms;
};

/**
 * Deadline-first ordering, shared by "Top by Weight" (urgency mode) and the
 * "Up Next" list so both order identically under "By urgency":
 *   overdue first (most overdue first) → priority → soonest due → most
 *   recently updated.
 */
export const compareByUrgency = (a: TopWeightTask, b: TopWeightTask, todayMs: number): number => {
    const da = a.dueDate ? new Date(a.dueDate).getTime() : Infinity;
    const db = b.dueDate ? new Date(b.dueDate).getTime() : Infinity;
    const aOver = a.dueDate != null && da < todayMs;
    const bOver = b.dueDate != null && db < todayMs;
    if (aOver !== bOver) return aOver ? -1 : 1;
    if (aOver && bOver) return da - db;

    const pa = PRIORITY_RANK[a.priority ?? ""] ?? 5;
    const pb = PRIORITY_RANK[b.priority ?? ""] ?? 5;
    if (pa !== pb) return pa - pb;

    if (da !== db) return da - db;

    const ua = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const ub = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    return ub - ua;
};

/**
 * "By weight" ordering: heaviest first, then soonest due date, then status
 * rank. Undated tasks sink to the bottom — "no deadline" isn't an extreme
 * deadline — and an unparseable date is treated as undated.
 */
const compareByWeight = (a: TopWeightRow, b: TopWeightRow): number => {
    if (a.weight !== b.weight) return b.weight - a.weight;

    const at = dueTime(a.task.dueDate);
    const bt = dueTime(b.task.dueDate);
    if (at === null || bt === null) {
        if (at !== bt) return at === null ? 1 : -1;
    } else if (at !== bt) {
        return at - bt;
    }

    const ar = STATUS_RANK[a.task.effectiveStatus] ?? 99;
    const br = STATUS_RANK[b.task.effectiveStatus] ?? 99;
    return ar - br;
};

/** Reorder (never re-select) the shortlist. Returns a new array. */
export const sortTopWeightRows = <T extends TopWeightRow>(
    rows: T[],
    mode: TopWeightSortMode,
    todayMs: number
): T[] => {
    const out = rows.slice();
    if (mode === "urgency") {
        return out.sort((a, b) => {
            const c = compareByUrgency(a.task, b.task, todayMs);
            // Ties fall back to heaviest-first so the panel's own ranking
            // still shows through inside an urgency group.
            return c !== 0 ? c : b.weight - a.weight;
        });
    }
    return out.sort(compareByWeight);
};
