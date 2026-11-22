import { calendarDaysUntil } from "../../../utils/calendarDate";
import type { Sprint } from "../sprint-milestone/types";
import { isDueWithin, isOverdueDate } from "./dueWindow";
import { EffectiveTask } from "./effectiveTasks";
import { countMilestoneTaskStatuses, MilestoneProgressEntry } from "./milestoneTaskProgress";

/**
 * The numbers behind the Milestones tab of the Tasks dashboard (MIP-1187): progress by
 * status, what is overdue, due soon or blocked, when the milestone itself is due, and when
 * anything under it last moved. Pure: it reads the rows the dashboard already holds
 * (`effectiveTasks`, which has Deleted dropped and Closed ancestors applied), so the view
 * costs no request.
 */

/** An open milestone with no progress for this many days reads as stalled. */
export const STALE_PROGRESS_DAYS = 7;

/** "Due soon" = due within this many calendar days (today included). */
export const DUE_SOON_DAYS = 7;

export type MilestoneRef = {
    milestoneId: number;
    taskId: number | null;
    status: string;
    dueDate: string | null;
    /** The milestone's own newest-progress stamp, when the list endpoint carries it. */
    lastProgressAt?: string | null;
    /** When it was created: the stall clock for a milestone nothing has ever touched. */
    tsCreatedAt?: string | null;
};

export type MilestoneProgressSummary = {
    milestoneId: number;
    total: number;
    closed: number;
    entries: MilestoneProgressEntry[];
    overdue: EffectiveTask[];
    dueSoon: EffectiveTask[];
    blocked: EffectiveTask[];
    /** Overdue, then blocked, then due soon; each task once; soonest due first inside a group. */
    attention: EffectiveTask[];
    /** Calendar days until the milestone's own due date (negative when past); null when unset. */
    dueInDays: number | null;
    /** The newest progress stamp (ISO), or null when none is recorded. */
    lastProgressAt: string | null;
    /** Whole days since the newest progress under the milestone; null when none is recorded. */
    daysSinceProgress: number | null;
    /** Whole days of silence the stall test uses: since the newest progress, else since creation. */
    idleDays: number | null;
    /** The milestone is open and has seen no progress for `STALE_PROGRESS_DAYS` days. */
    stalled: boolean;
};

const DAY_MS = 86_400_000;

const dueKey = (t: EffectiveTask): number => {
    const ms = t.dueDate ? new Date(t.dueDate).getTime() : Number.POSITIVE_INFINITY;
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
};

export const summarizeMilestoneProgress = (
    milestone: MilestoneRef,
    tasks: ReadonlyArray<EffectiveTask>,
    now: Date = new Date()
): MilestoneProgressSummary => {
    const children = tasks.filter(
        (t) => t.milestoneId === milestone.milestoneId && !t.isMilestone
    );
    const backing =
        milestone.taskId == null
            ? undefined
            : tasks.find((t) => t.isMilestone && String(t.id) === String(milestone.taskId));

    const { entries, total } = countMilestoneTaskStatuses(children.map((t) => t.effectiveStatus));
    const open = children.filter((t) => t.effectiveStatus !== "Closed");
    const overdue = open
        .filter((t) => isOverdueDate(t.dueDate, now))
        .sort((a, b) => dueKey(a) - dueKey(b));
    const blocked = open
        .filter((t) => t.effectiveStatus === "Blocked")
        .sort((a, b) => dueKey(a) - dueKey(b));
    const dueSoon = open
        .filter(
            (t) => isDueWithin(t.dueDate, now, DUE_SOON_DAYS) && !isOverdueDate(t.dueDate, now)
        )
        .sort((a, b) => dueKey(a) - dueKey(b));

    // Each task once, in the order overdue → blocked → due soon.
    const attention: EffectiveTask[] = [];
    const seen = new Set<string>();
    for (const t of [...overdue, ...blocked, ...dueSoon]) {
        const key = String(t.id);
        if (seen.has(key)) continue;
        seen.add(key);
        attention.push(t);
    }

    // The milestone's own row carries the newest progress under it (MIP-1351), so read it
    // there; fall back to the newest child stamp when the backing row is not loaded.
    let lastProgressAt: string | null = null;
    let newest: number | null = null;
    for (const stamp of [
        milestone.lastProgressAt,
        backing?.lastProgressAt,
        ...children.map((t) => t.lastProgressAt),
    ]) {
        const ms = stamp ? new Date(stamp).getTime() : Number.NaN;
        if (Number.isFinite(ms) && (newest == null || ms > newest)) {
            newest = ms;
            lastProgressAt = stamp ?? null;
        }
    }
    const daysSinceProgress =
        newest == null ? null : Math.max(0, Math.floor((now.getTime() - newest) / DAY_MS));

    // Never touched: the clock starts when the milestone was created.
    const createdMs = milestone.tsCreatedAt
        ? new Date(milestone.tsCreatedAt).getTime()
        : Number.NaN;
    const idleFrom = newest ?? (Number.isFinite(createdMs) ? createdMs : null);
    const idleDays =
        idleFrom == null ? null : Math.max(0, Math.floor((now.getTime() - idleFrom) / DAY_MS));

    const isOpenMilestone = milestone.status !== "Closed" && milestone.status !== "Deleted";

    return {
        milestoneId: milestone.milestoneId,
        total,
        closed: children.filter((t) => t.effectiveStatus === "Closed").length,
        entries,
        overdue,
        dueSoon,
        blocked,
        attention,
        dueInDays: milestone.dueDate ? calendarDaysUntil(milestone.dueDate, now) : null,
        lastProgressAt,
        daysSinceProgress,
        idleDays,
        stalled: isOpenMilestone && idleDays != null && idleDays >= STALE_PROGRESS_DAYS,
    };
};

export type MilestoneProgressOverview = {
    milestones: number;
    tasks: number;
    closed: number;
    overdue: number;
    blocked: number;
    stalled: number;
};

/** The totals for the summary strip above the milestone cards. */
export const summarizeMilestoneProgressOverview = (
    summaries: ReadonlyArray<MilestoneProgressSummary>
): MilestoneProgressOverview =>
    summaries.reduce<MilestoneProgressOverview>(
        (acc, s) => ({
            milestones: acc.milestones + 1,
            tasks: acc.tasks + s.total,
            closed: acc.closed + s.closed,
            overdue: acc.overdue + s.overdue.length,
            blocked: acc.blocked + s.blocked.length,
            stalled: acc.stalled + (s.stalled ? 1 : 0),
        }),
        { milestones: 0, tasks: 0, closed: 0, overdue: 0, blocked: 0, stalled: 0 }
    );

export type MilestoneSprintGroup<M extends { milestoneId: number; sprintId?: number | null }> = {
    /** The sprint, or null for the milestones of no sprint (or of a sprint that is not loaded). */
    sprint: Sprint | null;
    items: { milestone: M; summary: MilestoneProgressSummary }[];
    rollup: MilestoneProgressOverview & { lastProgressAt: string | null };
};

const SPRINT_RANK: Record<string, number> = { active: 0, upcoming: 1, completed: 2, archived: 3 };

const startMs = (s: Sprint): number => {
    const ms = new Date(s.startDate).getTime();
    return Number.isFinite(ms) ? ms : 0;
};

/**
 * The milestones grouped by sprint (MIP-1909): the active sprint first, then upcoming ones
 * soonest first, then completed and archived ones newest first; the milestones of no sprint last.
 * `summaries` is parallel to `milestones`, which keep their own order inside a group. Each group
 * carries the roll-up of its milestones (closed, blocked, overdue, stalled, newest progress).
 */
export const groupMilestonesBySprint = <
    M extends { milestoneId: number; sprintId?: number | null },
>(
    milestones: ReadonlyArray<M>,
    summaries: ReadonlyArray<MilestoneProgressSummary>,
    sprints: ReadonlyArray<Sprint>
): MilestoneSprintGroup<M>[] => {
    const bySprint = new Map<number, Sprint>(sprints.map((s) => [s.sprintId, s]));
    const buckets = new Map<number | null, MilestoneSprintGroup<M>["items"]>();
    milestones.forEach((milestone, i) => {
        const id =
            milestone.sprintId != null && bySprint.has(milestone.sprintId)
                ? milestone.sprintId
                : null;
        const list = buckets.get(id) ?? [];
        list.push({ milestone, summary: summaries[i] });
        buckets.set(id, list);
    });

    const rollupOf = (items: MilestoneSprintGroup<M>["items"]) => {
        let newest: number | null = null;
        let lastProgressAt: string | null = null;
        for (const { summary } of items) {
            const ms = summary.lastProgressAt ? new Date(summary.lastProgressAt).getTime() : NaN;
            if (Number.isFinite(ms) && (newest == null || ms > newest)) {
                newest = ms;
                lastProgressAt = summary.lastProgressAt;
            }
        }
        return {
            ...summarizeMilestoneProgressOverview(items.map((x) => x.summary)),
            lastProgressAt,
        };
    };

    const real = [...buckets.keys()]
        .filter((id): id is number => id != null)
        .map((id) => bySprint.get(id) as Sprint)
        .sort((a, b) => {
            const rank = (SPRINT_RANK[a.status] ?? 9) - (SPRINT_RANK[b.status] ?? 9);
            if (rank !== 0) return rank;
            const diff = startMs(a) - startMs(b);
            return a.status === "completed" || a.status === "archived" ? -diff : diff;
        });
    const groups: MilestoneSprintGroup<M>[] = real.map((sprint) => {
        const items = buckets.get(sprint.sprintId) ?? [];
        return { sprint, items, rollup: rollupOf(items) };
    });
    const none = buckets.get(null);
    if (none) groups.push({ sprint: null, items: none, rollup: rollupOf(none) });
    return groups;
};
