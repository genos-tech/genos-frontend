import { calendarDaysUntil } from "../../../utils/calendarDate";
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
