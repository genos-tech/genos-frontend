/**
 * Does a recurrence occur on a given local date?
 *
 * The todo scheduler stores an RRULE per rule and expands it on the
 * client: each day the pane checks whether any active rule "occurs on
 * today" and, if so, materializes a todo item. This is the expansion.
 *
 * Kept as a pure module — separate from `features/calendar/utils/rrule.ts`
 * so we don't touch the calendar's Google-facing code — because every
 * branch here is an off-by-one waiting to happen and a table test beats
 * clicking through midnight:
 *
 *  - **Everything is date-only.** Todos are keyed by the client's local
 *    calendar date ("YYYY-MM-DD"), never a datetime. We compare whole
 *    days with `startOf("day")` so a stray time component can't make a
 *    same-day comparison off by one.
 *  - **`interval` counts from `startDate`.** "Every 2 weeks" means weeks
 *    since the anchor, not since some arbitrary epoch — so the phase is
 *    measured against `startDate`.
 *  - **A target before `startDate` never occurs**, and neither does one
 *    past an `onDate`/`afterCount` end.
 *  - **Weekly with an empty `byWeekday`** falls back to the start date's
 *    own weekday, matching how the calendar's `buildRecurrence` lets
 *    Google infer BYDAY from the start.
 */

import dayjs, { Dayjs } from "dayjs";

import { RecurrenceSpec } from "../../calendar/utils/rrule";

/** Whole-day difference target − start (may be negative). */
const dayDiff = (start: Dayjs, target: Dayjs): number =>
    target.startOf("day").diff(start.startOf("day"), "day");

/**
 * The Nth occurrence's date for a COUNT-limited weekly-by-multiple-days
 * rule is awkward to compute closed-form, so `afterCount` is enforced by
 * walking occurrences from the start until we pass the target or exhaust
 * the count. Daily/weekly/monthly/yearly single-track rules are cheap
 * enough that one shared walker keeps the logic in a single place rather
 * than three subtly different closed forms.
 *
 * Bounded: stops at the target date, so the walk length is at most the
 * number of periods between start and target.
 */
const MAX_WALK = 100000; // ~270 years of daily; a runaway guard, never hit in practice

export const occursOn = (spec: RecurrenceSpec, startDate: string, target: string): boolean => {
    if (spec.frequency === "none") return false;

    const start = dayjs(startDate);
    const day = dayjs(target);
    if (!start.isValid() || !day.isValid()) return false;

    // Before the series begins.
    if (dayDiff(start, day) < 0) return false;

    const interval = spec.interval > 0 ? Math.floor(spec.interval) : 1;

    // Hard end date (inclusive), independent of frequency.
    if (spec.end.kind === "onDate") {
        const until = dayjs(spec.end.date);
        if (until.isValid() && dayDiff(until, day) > 0) return false;
    }

    // `afterCount` needs the occurrence's ordinal, so weekly (which can
    // fire multiple times per period) is walked; the single-track
    // frequencies get a closed-form phase check plus an ordinal for the
    // count bound.
    const countLimit =
        spec.end.kind === "afterCount" && spec.end.count > 0 ? Math.floor(spec.end.count) : null;

    if (spec.frequency === "weekly") {
        return occursWeekly(spec, start, day, interval, countLimit);
    }

    // daily / monthly / yearly: single occurrence per period.
    const diff = dayDiff(start, day);
    let ordinal: number; // 0-based index of this occurrence in the series
    let hits: boolean;
    if (spec.frequency === "daily") {
        hits = diff % interval === 0;
        ordinal = diff / interval;
    } else if (spec.frequency === "monthly") {
        // Same day-of-month, every `interval` months. A start on the
        // 31st simply doesn't occur in months that lack that day —
        // matching RRULE's default (no BYMONTHDAY clamping).
        if (day.date() !== start.date()) return false;
        const months = day.diff(start, "month");
        // `diff` floors; recheck the exact month landed on the target.
        if (!start.add(months, "month").isSame(day, "day")) return false;
        hits = months % interval === 0;
        ordinal = months / interval;
    } else {
        // yearly
        if (day.date() !== start.date() || day.month() !== start.month()) return false;
        const years = day.diff(start, "year");
        if (!start.add(years, "year").isSame(day, "day")) return false;
        hits = years % interval === 0;
        ordinal = years / interval;
    }

    if (!hits) return false;
    if (countLimit !== null && ordinal >= countLimit) return false;
    return true;
};

/**
 * Weekly rules can fire on several weekdays per week, so "the Nth
 * occurrence" (for the count bound) isn't a simple division.
 *
 * "Week" here is a ROLLING 7-day window anchored at `startDate`, not a
 * calendar week: window 0 is the 7 days from the start, window 1 the
 * next 7, and so on. This makes "every other Monday" starting on a
 * Saturday mean the very next Monday, then skip a week — the intuitive
 * reading — instead of depending on which calendar week the Saturday and
 * the Monday happen to fall in (the calendar's own `buildRecurrence`
 * doesn't emit WKST either, so there's no stricter contract to honor).
 */
const occursWeekly = (
    spec: RecurrenceSpec,
    start: Dayjs,
    target: Dayjs,
    interval: number,
    countLimit: number | null
): boolean => {
    // Empty byWeekday → the start's own weekday (mirrors buildRecurrence,
    // which lets Google infer BYDAY from the start date).
    const weekdays =
        spec.byWeekday.length > 0
            ? [...new Set(spec.byWeekday)].filter((d) => d >= 0 && d <= 6).sort((a, b) => a - b)
            : [start.day()];
    if (weekdays.length === 0) return false;

    // The target must land on one of the rule's weekdays at all.
    if (!weekdays.includes(target.day())) return false;

    const diff = dayDiff(start, target);
    // Off-cadence window (e.g. every-other-week landing on an odd window).
    if (Math.floor(diff / 7) % interval !== 0) return false;

    // On-cadence, correct weekday, within range — occurs. Only the count
    // bound needs the ordinal, so skip the walk entirely when unbounded.
    if (countLimit === null) return true;

    // Ordinal (1-based) of the target within the series: count matching
    // days from the start up to and including the target. Bounded — the
    // target is at most `countLimit` occurrences in for a rule that still
    // fires, and the guard caps a pathological far-future target.
    let count = 0;
    let guard = 0;
    for (
        let d = start.startOf("day");
        !d.isAfter(target) && guard < MAX_WALK;
        d = d.add(1, "day"), guard++
    ) {
        const isOccurrence =
            weekdays.includes(d.day()) && Math.floor(dayDiff(start, d) / 7) % interval === 0;
        if (!isOccurrence) continue;
        count++;
        if (count > countLimit) return false; // target is past the count
        if (d.isSame(target, "day")) return true;
    }
    return false;
};
