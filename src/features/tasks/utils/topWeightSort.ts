import { STATUS_RANK } from "./sortTask";

/**
 * Ordering for the dashboard's "Top by Weight" shortlist.
 *
 * This only decides how the panel's rows are READ — the shortlist itself is
 * always the highest-weight active tasks, which is what the panel is. Sorting
 * before the selection would silently turn it into a different panel (a
 * due-date list that happens to be titled "Top by Weight").
 */

export type TopWeightSortField = "weight" | "dueDate" | "status";
export type SortDir = "asc" | "desc";
export type TopWeightSort = { field: TopWeightSortField; dir: SortDir };

/**
 * Direction a field starts on when first picked. Weight: heaviest first.
 * Due date: latest first. Status: Open → WIP → Blocked → Pending, i.e.
 * not-started work first.
 */
export const TOP_WEIGHT_DEFAULT_DIR: Record<TopWeightSortField, SortDir> = {
    weight: "desc",
    dueDate: "desc",
    status: "asc",
};

/** Clicking the active field flips it; a new field starts on its default. */
export const nextTopWeightSort = (
    prev: TopWeightSort,
    field: TopWeightSortField
): TopWeightSort =>
    prev.field === field
        ? { field, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { field, dir: TOP_WEIGHT_DEFAULT_DIR[field] };

/** The shape the panel rows carry — structural so the dashboard's richer
 *  `EffectiveTask` row satisfies it without importing it here. */
export type TopWeightRow = {
    task: { dueDate?: string | null; effectiveStatus: string };
    weight: number;
};

// ms since epoch, or null for a missing/unparseable date.
const dueTime = (dueDate: string | null | undefined): number | null => {
    if (!dueDate) return null;
    const ms = new Date(dueDate).getTime();
    return Number.isNaN(ms) ? null : ms;
};

/** Reorder (never re-select) the shortlist. Returns a new array. */
export const sortTopWeightRows = <T extends TopWeightRow>(
    rows: T[],
    { field, dir }: TopWeightSort
): T[] => {
    const mul = dir === "asc" ? 1 : -1;
    return rows.slice().sort((a, b) => {
        if (field === "dueDate") {
            const at = dueTime(a.task.dueDate);
            const bt = dueTime(b.task.dueDate);
            // Undated tasks sink to the bottom in BOTH directions — "no
            // deadline" isn't an extreme deadline, and flipping the arrow
            // shouldn't hoist them over dated work.
            if (at === null || bt === null) {
                if (at !== bt) return at === null ? 1 : -1;
            } else if (at !== bt) {
                return (at - bt) * mul;
            }
        } else if (field === "status") {
            // `effectiveStatus` (the parent-chain rollup) is what the row's
            // status chip renders, so grouping matches what the user sees.
            // Unknown labels sort last.
            const ar = STATUS_RANK[a.task.effectiveStatus] ?? 99;
            const br = STATUS_RANK[b.task.effectiveStatus] ?? 99;
            if (ar !== br) return (ar - br) * mul;
        } else if (a.weight !== b.weight) {
            return (a.weight - b.weight) * mul;
        }
        // Ties fall back to heaviest-first so the panel's own ranking still
        // shows through inside a due-date or status group.
        return b.weight - a.weight;
    });
};
