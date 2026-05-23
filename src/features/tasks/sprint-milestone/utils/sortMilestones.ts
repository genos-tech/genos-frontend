import { Milestone, Sprint } from "../types";

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

// Shared palette for the milestone status chip. Mirrors the table's
// `statusOptions` swatch in `DraggableTaskTable.tsx` so the milestone
// status chip looks identical to the row's status chip across the
// sidebar (`MilestonesListItem`), the table filter dropdown
// (`TaskFilterMenu`) and any future surface that needs to render a
// milestone status badge. Anything outside this map falls back to the
// `Open` tone so an unknown / future status still renders sensibly.
export const MILESTONE_STATUS_CHIP_COLORS: Record<string, { color: string; textColor: string }> = {
    Open: { color: "#0044c2", textColor: "#ffffff" },
    WIP: { color: "#ff8c00", textColor: "#ffffff" },
    Pending: { color: "#b900ff", textColor: "#ffffff" },
    Closed: { color: "#1dc200", textColor: "#ffffff" },
    Deleted: { color: "#ff2323", textColor: "#ffffff" },
};

/** Resolve the chip palette for a milestone status, falling back to the `Open` tone. */
export const getMilestoneStatusChipColor = (
    status: string | null | undefined
): { color: string; textColor: string } =>
    (status && MILESTONE_STATUS_CHIP_COLORS[status]) || MILESTONE_STATUS_CHIP_COLORS.Open;

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

// Sprint statuses that count as "the sprint is over". Closed milestones
// tied to one of these sprints fall off the visible list so the sidebar
// (and any consumer using `selectVisibleMilestones`) doesn't accumulate
// finished items forever; "active" / "upcoming" sprints keep their
// milestones visible regardless of milestone status.
export const ENDED_SPRINT_STATUSES = new Set<Sprint["status"]>(["completed", "archived"]);

/**
 * Shared visibility selector for project milestones. Mirrors the
 * sidebar's `MilestonesListItem` rules so every surface that lists
 * "currently relevant" milestones (sidebar, table filter, etc.) works
 * off the exact same set:
 *   - Always hide soft-deleted milestones and the "Deleted" status.
 *   - Hide a Closed milestone only when its sprint is known AND
 *     already ended (completed/archived). Closed-without-sprint and
 *     Closed-while-sprint-data-still-loading both stay so we don't
 *     flicker rows out before sprint data arrives.
 *   - Anything else (Open / WIP / Pending in any sprint or no sprint,
 *     plus Closed in active / upcoming sprints) stays.
 *
 * Output is sorted via `compareMilestones` (3-level: due-date → status
 * → title) so callers don't need to re-sort.
 */
/**
 * Sibling of `selectVisibleMilestones` for sprints. Returns the sprints
 * that count as "currently relevant" — anything not soft-deleted and
 * not already in an ended state (`completed` / `archived`). Order is
 * preserved from the input; callers that need a specific order should
 * sort themselves (the picker relies on the upstream order from
 * `useSM.projectSprints`).
 */
export const selectVisibleSprints = (sprints: Sprint[]): Sprint[] =>
    sprints.filter((s) => !s.isDeleted && !ENDED_SPRINT_STATUSES.has(s.status));

export const selectVisibleMilestones = (
    milestones: Milestone[],
    sprints: Sprint[]
): Milestone[] => {
    const endedSprintIds = new Set<number>(
        sprints
            .filter((s) => !s.isDeleted && ENDED_SPRINT_STATUSES.has(s.status))
            .map((s) => s.sprintId)
    );
    return milestones
        .filter((m) => {
            if (m.isDeleted || m.status === "Deleted") return false;
            if (m.status === "Closed" && m.sprintId != null) {
                return !endedSprintIds.has(m.sprintId);
            }
            return true;
        })
        .sort(compareMilestones);
};
