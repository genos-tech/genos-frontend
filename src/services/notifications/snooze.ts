/**
 * The client half of the Slack-style "pause notifications" predicate.
 *
 * This MIRRORS the server contract in `origin/services/notification_snooze.py`
 * exactly — same two forms, same overnight branch, same `start == end` → never
 * rule — because the two evaluate the same stored `snooze_until` /
 * `snooze_schedule` and must agree at the edges (the server gates push + email;
 * this gates in-app toasts + the presence badge). Any change here needs the
 * same change there.
 *
 * Two forms of pause, OR'd together:
 *   1. `snoozeUntil` — a one-shot absolute UTC instant. While `now < until`
 *      everything is paused. Timezone-independent (it's an instant, not a
 *      wall-clock time), so it needs no zone.
 *   2. `snoozeSchedule` — a recurring daily quiet window in the user's LOCAL
 *      wall-clock, overnight-capable. Evaluated in `zone`, which the React
 *      layer resolves as `currentLocation > timezone > browser` (see
 *      `utils/userTimezone.ts#resolveZone`) — the SAME order the profile card
 *      uses, so the window fires at the hours the user thinks it will.
 */

import { isValidZone } from "../../utils/userTimezone";

/** Recurring daily quiet window; `start`/`end` are "HH:MM" 24-hour local. */
export interface SnoozeSchedule {
    enabled: boolean;
    start: string;
    end: string;
}

/** Local hour a "until tomorrow" / "until next week" preset resumes at. */
const RESUME_HOUR_LOCAL = 8;

/** A zone the runtime can format with, or "UTC" — never throws downstream. */
const safeZone = (zone: string): string => (isValidZone(zone) ? zone : "UTC");

/**
 * "HH:MM" → minutes-since-local-midnight, or `null` if malformed / out of
 * range. Matches the server's `_minutes_of_day` (the serializer already
 * rejects bad values on save; this is defence for anything already stored).
 */
const parseHhmm = (hhmm: string): number | null => {
    const m = /^(\d{2}):(\d{2})$/.exec(hhmm);
    if (!m) return null;
    const h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    if (h < 0 || h > 23 || min < 0 || min > 59) return null;
    return h * 60 + min;
};

/**
 * Minutes-since-midnight of `date` as read in `zone`, or `null` if the zone
 * won't format. `formatToParts` with `hour12: false` avoids the locale
 * ambiguity of a "HH:MM" string (some locales render 12-hour or AM/PM).
 */
const minutesOfDayInZone = (zone: string, date: Date): number | null => {
    try {
        const parts = new Intl.DateTimeFormat("en-GB", {
            timeZone: zone,
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
        }).formatToParts(date);
        const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
        let hour = parseInt(get("hour"), 10);
        const minute = parseInt(get("minute"), 10);
        if (Number.isNaN(hour) || Number.isNaN(minute)) return null;
        if (hour === 24) hour = 0; // some runtimes emit "24" at local midnight
        return hour * 60 + minute;
    } catch {
        return null;
    }
};

/**
 * Is the recurring window active right now? Mirrors the server branch:
 *   disabled / malformed        → false
 *   start == end                → false (a zero-width window means "never",
 *                                 NOT "always" — the explicit off state)
 *   start <  end (same day)     → start <= m < end
 *   start >  end (overnight)    → m >= start || m < end
 */
const scheduleActiveNow = (
    schedule: SnoozeSchedule | null | undefined,
    zone: string,
    now: number
): boolean => {
    if (!schedule || !schedule.enabled) return false;
    const s = parseHhmm(schedule.start);
    const e = parseHhmm(schedule.end);
    if (s === null || e === null) return false;
    if (s === e) return false;
    const m = minutesOfDayInZone(safeZone(zone), new Date(now));
    if (m === null) return false;
    return s < e ? m >= s && m < e : m >= s || m < e;
};

/**
 * The one predicate the manager, the heartbeat, and the pause hook all call.
 * `zone` is only consulted for the schedule branch; the one-shot instant is
 * zone-independent.
 */
export const isSnoozedNow = (
    snoozeUntil: string | null | undefined,
    snoozeSchedule: SnoozeSchedule | null | undefined,
    zone: string = "UTC",
    now: number = Date.now()
): boolean => {
    if (snoozeUntil) {
        const until = Date.parse(snoozeUntil);
        if (!Number.isNaN(until) && now < until) return true;
    }
    return scheduleActiveNow(snoozeSchedule, zone, now);
};

/**
 * ms from `now` until the pause state could next flip, or `null` if it never
 * will (no one-shot, no enabled schedule). The reactive-expiry timer arms a
 * `setTimeout` to this so a lapsed pause clears the badge/gate without a
 * refresh. Returns the SOONEST of: the one-shot expiry, the next schedule
 * `start`, and the next schedule `end`.
 *
 * Wall-clock minute boundaries align with epoch-minute boundaries (every IANA
 * offset is a whole number of minutes), so `now % 60000` is the ms already
 * elapsed into the current minute — subtracting it lands the timer exactly on
 * the top of the target minute.
 */
export const msUntilNextBoundary = (
    snoozeUntil: string | null | undefined,
    snoozeSchedule: SnoozeSchedule | null | undefined,
    zone: string = "UTC",
    now: number = Date.now()
): number | null => {
    const candidates: number[] = [];

    if (snoozeUntil) {
        const until = Date.parse(snoozeUntil);
        if (!Number.isNaN(until) && until > now) candidates.push(until - now);
    }

    if (snoozeSchedule && snoozeSchedule.enabled) {
        const s = parseHhmm(snoozeSchedule.start);
        const e = parseHhmm(snoozeSchedule.end);
        const m = minutesOfDayInZone(safeZone(zone), new Date(now));
        if (s !== null && e !== null && s !== e && m !== null) {
            const msToMinuteOfDay = (target: number): number => {
                let deltaMin = (target - m + 1440) % 1440;
                if (deltaMin === 0) deltaMin = 1440; // it's this minute now → next is tomorrow
                return deltaMin * 60000 - (now % 60000);
            };
            candidates.push(msToMinuteOfDay(s), msToMinuteOfDay(e));
        }
    }

    return candidates.length ? Math.min(...candidates) : null;
};

// ----- Duration builders for the one-shot presets --------------------------
//
// Each returns an absolute UTC ISO instant to store in `snoozeUntil`. The
// fixed-duration presets (30m / 1h / 2h) don't need a builder — the hook does
// `new Date(Date.now() + ms).toISOString()`. These two resolve a LOCAL morning
// hour and so need the user's zone.

/** Local calendar Y/M/D of `date` as read in `zone`. */
const localDateParts = (
    zone: string,
    date: Date
): { year: number; month: number; day: number } => {
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
    }).formatToParts(date);
    const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
    return { year: get("year"), month: get("month"), day: get("day") };
};

/** Local weekday of `date` in `zone`, 0=Sunday … 6=Saturday. */
const localWeekday = (zone: string, date: Date): number => {
    const short = new Intl.DateTimeFormat("en-US", { timeZone: zone, weekday: "short" }).format(
        date
    );
    const map: Record<string, number> = {
        Sun: 0,
        Mon: 1,
        Tue: 2,
        Wed: 3,
        Thu: 4,
        Fri: 5,
        Sat: 6,
    };
    return map[short] ?? 0;
};

/**
 * The epoch ms of local wall-clock `Y/M/D hh:mm` in `zone`. Out-of-range
 * day/month components normalize (day 32 → next month) via `Date.UTC`.
 *
 * Guess the instant as if the components were UTC, read the zone's offset at
 * that guess, then subtract it. A single correction is exact except within the
 * one-hour DST gap/overlap twice a year — acceptable for a resume time the
 * user reads to the minute, and the stored value is an absolute instant that
 * self-corrects.
 */
const wallClockToEpoch = (
    zone: string,
    year: number,
    month: number,
    day: number,
    hour: number,
    minute: number
): number => {
    const guess = Date.UTC(year, month - 1, day, hour, minute);
    const parts = new Intl.DateTimeFormat("en-CA", {
        timeZone: zone,
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: false,
    }).formatToParts(new Date(guess));
    const get = (t: string) => parseInt(parts.find((p) => p.type === t)?.value ?? "0", 10);
    let gh = get("hour");
    if (gh === 24) gh = 0;
    const asUtc = Date.UTC(
        get("year"),
        get("month") - 1,
        get("day"),
        gh,
        get("minute"),
        get("second")
    );
    const offsetMin = Math.round((asUtc - guess) / 60000);
    return guess - offsetMin * 60000;
};

/** Tomorrow at {@link RESUME_HOUR_LOCAL}:00 local, as a UTC ISO instant. */
export const untilTomorrow = (zone: string = "UTC", now: number = Date.now()): string => {
    const z = safeZone(zone);
    const { year, month, day } = localDateParts(z, new Date(now));
    return new Date(wallClockToEpoch(z, year, month, day + 1, RESUME_HOUR_LOCAL, 0)).toISOString();
};

/**
 * Next Monday at {@link RESUME_HOUR_LOCAL}:00 local, as a UTC ISO instant. If
 * today is Monday it skips a full week (so "next week" is never "in a few
 * hours").
 */
export const untilNextWeek = (zone: string = "UTC", now: number = Date.now()): string => {
    const z = safeZone(zone);
    const d = new Date(now);
    const { year, month, day } = localDateParts(z, d);
    let add = (1 - localWeekday(z, d) + 7) % 7; // days to the coming Monday
    if (add === 0) add = 7;
    return new Date(
        wallClockToEpoch(z, year, month, day + add, RESUME_HOUR_LOCAL, 0)
    ).toISOString();
};
