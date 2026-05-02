import { Milestone } from "../types";

/**
 * Shared milestone sort logic. Used by the sidebar `MilestonesListItem`
 * and the `SprintMilestonePicker` so both surfaces present milestones in
 * the same order regardless of where the user is interacting with them.
 *
 * Three-level sort:
 *   1. due-date ascending (`null` / `undefined` / empty string sorted last)
 *   2. custom status order (Open → WIP → Pending → Closed → unknown)
 *   3. title ascending (locale aware)
 *
 * Each level only kicks in when the previous one tied, so groups stay
 * grouped: all items sharing a due date are sorted by status amongst
 * themselves, and within a single (date, status) bucket items are
 * sorted by title.
 */

// Custom display order for the milestone status chip. Anything not
// in this list is treated as "after Closed" so unknown / future
// statuses don't silently bubble to the top.
export const MILESTONE_STATUS_ORDER = ["Open", "WIP", "Pending", "Closed"] as const;
const MILESTONE_STATUS_LAST = MILESTONE_STATUS_ORDER.length;

// Compare two due dates with `null` / `undefined` / empty-string sorted
// last. Returns the standard Array.sort sign (negative => a first).
export const compareDueDate = (
    a: string | null | undefined,
    b: string | null | undefined
): number => {
    const aHas = !!a;
    const bHas = !!b;
    if (aHas && !bHas) return -1;
    if (!aHas && bHas) return 1;
    if (!aHas && !bHas) return 0;
    return new Date(a as string).getTime() - new Date(b as string).getTime();
};

// Compare two milestone statuses against `MILESTONE_STATUS_ORDER`.
// Unknown values fall to the bottom of the list.
export const compareMilestoneStatus = (a: string, b: string): number => {
    const ia = MILESTONE_STATUS_ORDER.indexOf(a as (typeof MILESTONE_STATUS_ORDER)[number]);
    const ib = MILESTONE_STATUS_ORDER.indexOf(b as (typeof MILESTONE_STATUS_ORDER)[number]);
    return (ia === -1 ? MILESTONE_STATUS_LAST : ia) - (ib === -1 ? MILESTONE_STATUS_LAST : ib);
};

/** Combined comparator implementing the three-level sort described above. */
export const compareMilestones = (a: Milestone, b: Milestone): number => {
    const dateCmp = compareDueDate(a.dueDate, b.dueDate);
    if (dateCmp !== 0) return dateCmp;
    const statusCmp = compareMilestoneStatus(a.status as string, b.status as string);
    if (statusCmp !== 0) return statusCmp;
    return a.title.localeCompare(b.title);
};
