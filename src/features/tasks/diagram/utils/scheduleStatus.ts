// One canonical schedule-status computation shared by the task node
// card, the milestone node card, and the modal header pill. Keeping
// it here means every surface answers "is this task on track, soon,
// or overdue?" the same way, with the same color thresholds.

export type ScheduleTone = "neutral" | "amber" | "red" | "success";

export type ScheduleStatus = {
    /** Tone for badges / left-edge stripes. */
    tone: ScheduleTone;
    /**
     * Short relative description anchored on the due date. Examples:
     *   - "Due in 5d"
     *   - "Due tomorrow"
     *   - "Due today"
     *   - "Overdue 2d"
     * Null when there is no due date.
     */
    relativeLabel: string | null;
    /**
     * Inclusive span between start and due, in whole days. Null when
     * either date is missing. Minimum is 1 (start == due → "1d").
     */
    durationDays: number | null;
    /** Formatted "MMM D" for the start date (null when not set). */
    startLabel: string | null;
    /** Formatted "MMM D" for the due date (null when not set). */
    dueLabel: string | null;
    /** Plural-aware days-until-due (negative = overdue). Null when no due date. */
    daysUntilDue: number | null;
};

const MS_PER_DAY = 24 * 60 * 60 * 1000;

const parseIsoDate = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const trimmed = iso.length >= 10 ? iso.slice(0, 10) : iso;
    const d = new Date(trimmed);
    if (Number.isNaN(d.getTime())) return null;
    // Anchor at local midnight so relative-day math doesn't drift
    // across timezones.
    return new Date(d.getFullYear(), d.getMonth(), d.getDate());
};

const todayLocalMidnight = (): Date => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), n.getDate());
};

const fmt = (d: Date | null): string | null =>
    d == null ? null : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });

const buildRelativeLabel = (daysUntilDue: number, isClosed: boolean): string => {
    if (isClosed) return "Closed";
    if (daysUntilDue < 0) {
        const n = -daysUntilDue;
        if (n === 0) return "Due today";
        if (n === 1) return "Overdue 1d";
        return `Overdue ${n}d`;
    }
    if (daysUntilDue === 0) return "Due today";
    if (daysUntilDue === 1) return "Due tomorrow";
    return `Due in ${daysUntilDue}d`;
};

const buildTone = (daysUntilDue: number | null, isClosed: boolean): ScheduleTone => {
    if (isClosed) return "success";
    if (daysUntilDue == null) return "neutral";
    if (daysUntilDue < 0) return "red";
    if (daysUntilDue <= 3) return "amber";
    return "neutral";
};

/**
 * Inputs are ISO YYYY-MM-DD strings (or null). `status` is the task
 * status string; "Closed" overrides everything else with a success
 * tone — a closed task isn't "overdue" anymore, it's done.
 */
export const getScheduleStatus = (
    startDate: string | null | undefined,
    dueDate: string | null | undefined,
    status: string | null | undefined
): ScheduleStatus => {
    const start = parseIsoDate(startDate);
    const due = parseIsoDate(dueDate);
    const today = todayLocalMidnight();
    const isClosed = (status ?? "").toLowerCase() === "closed";

    const daysUntilDue =
        due == null ? null : Math.round((due.getTime() - today.getTime()) / MS_PER_DAY);

    const durationDays =
        start != null && due != null
            ? Math.max(1, Math.round((due.getTime() - start.getTime()) / MS_PER_DAY) + 1)
            : null;

    return {
        tone: buildTone(daysUntilDue, isClosed),
        relativeLabel: due == null ? null : buildRelativeLabel(daysUntilDue ?? 0, isClosed),
        durationDays,
        startLabel: fmt(start),
        dueLabel: fmt(due),
        daysUntilDue,
    };
};

/** Color tokens for each tone. Used as `color` for icons / chip text;
 *  callers wrap with alpha for backgrounds.                            */
export const TONE_COLOR: Record<ScheduleTone, string> = {
    neutral: "#94a3b8",
    amber: "#f59e0b",
    red: "#dc2626",
    success: "#16a34a",
};

// Milestone-level schedule health. The per-task `getScheduleStatus`
// asks "is this card overdue?"; this one asks "is the milestone on
// pace?" — comparing % closed against % time elapsed in the milestone
// window. Surfaces a single verdict + the two ratios so callers can
// also paint an "expected by now" marker on the progress bar.
export type ScheduleHealthTone = "on-track" | "at-risk" | "behind";

export type ScheduleHealth = {
    tone: ScheduleHealthTone;
    label: string;
    expectedPct: number;
    actualPct: number;
};

export type MilestoneWindow = { start: string; end: string };

/** Decide the time window we use for "expected progress". Sprint
 *  takes precedence (it's the canonical iteration window); otherwise
 *  fall back to the span of task dates. Returns `null` when neither
 *  is available — caller skips the health UI in that case. */
export const getMilestoneWindow = (input: {
    sprint?: { startDate: string; endDate: string } | null;
    spanStart?: string | null;
    spanEnd?: string | null;
}): MilestoneWindow | null => {
    if (input.sprint && input.sprint.startDate && input.sprint.endDate) {
        return { start: input.sprint.startDate, end: input.sprint.endDate };
    }
    if (input.spanStart && input.spanEnd) {
        return { start: input.spanStart, end: input.spanEnd };
    }
    return null;
};

/** Compute milestone-level schedule health. Returns `null` when the
 *  window is missing or unparseable; callers should hide the chip /
 *  marker in that case. Thresholds (gap > 25 → behind, > 10 → at risk)
 *  are deliberately wide so we don't flag a tree where one slow day
 *  out of fourteen as "behind"; only persistent slippage triggers. */
export const computeHealth = (
    window: MilestoneWindow | null,
    total: number,
    closed: number
): ScheduleHealth | null => {
    if (!window) return null;
    const start = parseIsoDate(window.start);
    const end = parseIsoDate(window.end);
    if (start == null || end == null) return null;
    const today = todayLocalMidnight();
    const range = end.getTime() - start.getTime();
    const elapsedRaw = today.getTime() - start.getTime();
    const expectedPct =
        range > 0
            ? Math.max(0, Math.min(1, elapsedRaw / range)) * 100
            : today.getTime() >= end.getTime()
              ? 100
              : 0;
    const actualPct = total > 0 ? (closed / total) * 100 : 0;
    const gap = expectedPct - actualPct;

    let tone: ScheduleHealthTone;
    if (today.getTime() > end.getTime() && actualPct < 100) {
        tone = "behind";
    } else if (gap > 25) {
        tone = "behind";
    } else if (gap > 10) {
        tone = "at-risk";
    } else {
        tone = "on-track";
    }
    const label = tone === "on-track" ? "On track" : tone === "at-risk" ? "At risk" : "Behind";
    return { tone, label, expectedPct, actualPct };
};

/** Color tokens for the health verdict. Distinct from per-task
 *  `TONE_COLOR` because the semantics are different (per-task urgency
 *  vs. milestone-level pace), and "On track" deserves its own green
 *  rather than the per-task `success` overload. */
export const HEALTH_TONE_COLOR: Record<ScheduleHealthTone, string> = {
    "on-track": "#16a34a",
    "at-risk": "#f59e0b",
    behind: "#dc2626",
};

/** Joy color name for chips (`success` | `warning` | `danger`). */
export const HEALTH_JOY_COLOR: Record<ScheduleHealthTone, "success" | "warning" | "danger"> = {
    "on-track": "success",
    "at-risk": "warning",
    behind: "danger",
};
