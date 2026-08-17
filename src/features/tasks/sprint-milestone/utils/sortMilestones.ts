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
export const MILESTONE_STATUS_ORDER = ["Open", "WIP", "Blocked", "Pending", "Closed"] as const;
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
    // Milestones auto-Block too now (dependency-driven) — without this a
    // blocked milestone chip fell back to the Open tone.
    Blocked: { color: "#e11d48", textColor: "#ffffff" },
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

/**
 * The complement of `selectVisibleSprints`: the ended (completed /
 * archived) sprints, most-recently-ended FIRST.
 *
 * Used by the task filter's "Show past sprints" expander, which exists for
 * the same reason the milestone filter's does — auto-rolling sprints
 * accumulate indefinitely, so listing every one of them inline would bury
 * the two or three the user actually works in.
 *
 * Order is imposed here rather than inherited: `selectVisibleSprints`
 * deliberately preserves the upstream ascending order (the next sprint is
 * the interesting one), but for finished sprints the interesting one is the
 * one that just ended. Ties and unparseable dates fall back to
 * `sequenceNumber`, so a hand-created ad-hoc sprint with a bad date still
 * lands in a stable place instead of drifting between renders.
 */
export const selectEndedSprints = (sprints: Sprint[]): Sprint[] => {
    const endTime = (s: Sprint): number => {
        const t = s.endDate ? new Date(s.endDate).getTime() : NaN;
        return Number.isFinite(t) ? t : -Infinity;
    };
    return sprints
        .filter((s) => !s.isDeleted && ENDED_SPRINT_STATUSES.has(s.status))
        .sort((a, b) => endTime(b) - endTime(a) || b.sequenceNumber - a.sequenceNumber);
};

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

/**
 * "Outdated" (past-sprint) milestones — the ones we hide from the board /
 * table (and the member filter) and surface only through the sidebar's
 * "Past milestones" folder.
 *
 * Definition is deliberately NARROW: a milestone is outdated iff it's
 * **Closed AND tied to an ended (completed/archived) sprint**. This is a
 * subset of what `selectVisibleMilestones` hides — it intentionally does
 * NOT include `Deleted`/soft-deleted milestones, because this set gates
 * TASK hiding (`getOutdatedMilestoneIds`) and a stray deleted milestone
 * slipping in would make its tasks vanish with no way to reach them.
 * Deleted milestones/tasks are already handled by the status/column logic.
 *
 * Sorted via `compareMilestones` so the sidebar folder needs no re-sort.
 */
export const selectOutdatedMilestones = (
    milestones: Milestone[],
    sprints: Sprint[]
): Milestone[] => {
    const endedSprintIds = new Set<number>(
        sprints
            .filter((s) => !s.isDeleted && ENDED_SPRINT_STATUSES.has(s.status))
            .map((s) => s.sprintId)
    );
    return milestones
        .filter(
            (m) =>
                !m.isDeleted &&
                m.status !== "Deleted" &&
                m.status === "Closed" &&
                m.sprintId != null &&
                endedSprintIds.has(m.sprintId)
        )
        .sort(compareMilestones);
};

/** Ids of the outdated milestones (see `selectOutdatedMilestones`) — the
 *  hide-set the task filter uses to drop outdated milestones and their tasks. */
export const getOutdatedMilestoneIds = (milestones: Milestone[], sprints: Sprint[]): Set<number> =>
    new Set(selectOutdatedMilestones(milestones, sprints).map((m) => m.milestoneId));

/** A sprint bucket of milestones inside a year bucket. */
export type MilestoneSprintGroup = {
    sprintId: number | null;
    sprintName: string;
    milestones: Milestone[];
};

/** A year bucket of sprint buckets — "2026" → [sprint-X, sprint-Y] → … */
export type MilestoneYearGroup = { year: string; sprints: MilestoneSprintGroup[] };

/** Fallback bucket labels for milestones with no resolvable date / sprint. */
export const MILESTONE_YEAR_UNKNOWN = "—";
export const MILESTONE_SPRINT_UNKNOWN = "—";

/**
 * Group milestones into a two-level year → sprint tree so a long history
 * (e.g. 10 years × 100 milestones) doesn't render as one giant flat list —
 * used by both the sidebar's "Past milestones" folder and the filter's
 * expander, which render it as `<year>/<sprint>/<milestone>`.
 *
 * The year comes from the milestone's SPRINT end date (past milestones are
 * always tied to an ended sprint), falling back to the milestone's own due
 * date; undatable ones land in a trailing "—" year. Within a year, sprints
 * are ordered most-recently-ended first (a null / unknown sprint sorts last).
 * Milestones within a sprint keep their incoming (already
 * `compareMilestones`-sorted) order.
 */
export const groupMilestonesByYearAndSprint = (
    milestones: Milestone[],
    sprints: Sprint[]
): MilestoneYearGroup[] => {
    const sprintById = new Map<number, Sprint>(sprints.map((s) => [s.sprintId, s]));
    const yearOf = (m: Milestone): string => {
        const raw =
            (m.sprintId != null ? sprintById.get(m.sprintId)?.endDate : null) || m.dueDate || null;
        if (!raw) return MILESTONE_YEAR_UNKNOWN;
        const y = new Date(raw).getFullYear();
        return Number.isFinite(y) ? String(y) : MILESTONE_YEAR_UNKNOWN;
    };
    const sprintEndTime = (sprintId: number | null): number => {
        if (sprintId == null) return -Infinity; // undated sprint bucket sorts last
        const end = sprintById.get(sprintId)?.endDate;
        const time = end ? new Date(end).getTime() : NaN;
        return Number.isFinite(time) ? time : -Infinity;
    };

    // year -> (sprint key -> milestones), preserving incoming milestone order.
    const byYear = new Map<string, Map<string, Milestone[]>>();
    for (const m of milestones) {
        const year = yearOf(m);
        const sprintKey = m.sprintId != null ? String(m.sprintId) : "none";
        let sprintMap = byYear.get(year);
        if (!sprintMap) {
            sprintMap = new Map<string, Milestone[]>();
            byYear.set(year, sprintMap);
        }
        const arr = sprintMap.get(sprintKey);
        if (arr) arr.push(m);
        else sprintMap.set(sprintKey, [m]);
    }

    return [...byYear.entries()]
        .sort(([a], [b]) => {
            if (a === MILESTONE_YEAR_UNKNOWN) return 1;
            if (b === MILESTONE_YEAR_UNKNOWN) return -1;
            return Number(b) - Number(a);
        })
        .map(([year, sprintMap]) => ({
            year,
            sprints: [...sprintMap.entries()]
                .map(([key, ms]) => {
                    const sprintId = key === "none" ? null : Number(key);
                    const sprint = sprintId != null ? sprintById.get(sprintId) : undefined;
                    return {
                        sprintId,
                        sprintName: sprint?.name || MILESTONE_SPRINT_UNKNOWN,
                        milestones: ms,
                    };
                })
                .sort((s1, s2) => sprintEndTime(s2.sprintId) - sprintEndTime(s1.sprintId)),
        }));
};
