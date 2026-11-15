// Reading and printing the times of a Google Calendar event (MIP-1059).
//
// Two shapes arrive and they are NOT the same kind of thing:
//
//   * what Google (and so a chip, or a card's `current` event) holds: a `date` (all-day,
//     `YYYY-MM-DD`, the end EXCLUSIVE) or a `dateTime` with an offset, an exact instant;
//   * what the agent proposes (`start_iso` / `end_iso`): a date, or a NAIVE local time with no
//     offset, which means "this wall-clock time in `time_zone`, else the member's zone". Reading
//     it with `new Date()` would use the browser's zone and be wrong for anyone whose browser
//     is not in their Genos zone.
//
// So a naive time is turned into an instant in the zone the card names (`instantOf`), two times
// are compared as instants, and every time is printed in one zone with `Intl`, so a "before" and
// an "after" on a card can be read against each other.
//
// Pure TypeScript (no React, no i18n): the words around a time are the caller's.

const DATE_ONLY = /^(\d{4})-(\d{2})-(\d{2})$/;
// Seconds may carry a fraction (`10:00:00.000`): it is still a naive time, with no offset.
const NAIVE = /^(\d{4})-(\d{2})-(\d{2})[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?$/;

/** `YYYY-MM-DD`: an all-day value (Google's `date`). */
export const isDateOnly = (value: string): boolean => DATE_ONLY.test(value.trim());

/** The wall clock `zone` shows at `instant`, read as if it were UTC (ms). Null for an unknown zone. */
const wallClockAsUtc = (instant: number, zone: string): number | null => {
    try {
        const parts = new Intl.DateTimeFormat("en-CA", {
            timeZone: zone,
            hourCycle: "h23",
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
        }).formatToParts(new Date(instant));
        const get = (type: string) => Number(parts.find((p) => p.type === type)?.value);
        return Date.UTC(
            get("year"),
            get("month") - 1,
            get("day"),
            get("hour"),
            get("minute"),
            get("second")
        );
    } catch {
        return null;
    }
};

/**
 * The instant (ms since the epoch) a time names. A value with an offset or `Z` is exact. A naive
 * local time is the wall clock in `zone`; without a usable `zone` it has no instant (null), and the
 * caller falls back to printing the text as it came. A date-only value is not an instant (null).
 */
export const instantOf = (
    value: string | null | undefined,
    zone?: string | null
): number | null => {
    const text = (value ?? "").trim();
    if (!text || DATE_ONLY.test(text)) return null;
    const m = NAIVE.exec(text);
    if (!m) {
        const t = Date.parse(text);
        return Number.isNaN(t) ? null : t;
    }
    if (!zone) return null;
    const wall = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], m[6] ? +m[6] : 0);
    // The zone's offset depends on the instant, which is what is being looked for: settle on it in two
    // passes (the second one corrects a wall time that falls across a daylight-saving change).
    let guess = wall;
    for (let pass = 0; pass < 2; pass++) {
        const shown = wallClockAsUtc(guess, zone);
        if (shown === null) return null;
        guess = wall - (shown - guess);
    }
    // The fraction is kept to the millisecond ("5" is 500 ms, "123456" is 123 ms). It is added after the
    // passes above, which read the zone's clock to the second.
    const ms = m[7] ? Number(`${m[7]}00`.slice(0, 3)) : 0;
    return guess + ms;
};

const addDays = (date: string, days: number): string => {
    const m = DATE_ONLY.exec(date.trim());
    if (!m) return date;
    const t = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3] + days));
    return t.toISOString().slice(0, 10);
};

/** Do two proposed/held times name the same moment (timed) or the same day (all-day)? */
export const sameWhen = (
    a: string | null | undefined,
    b: string | null | undefined,
    zone?: string | null
): boolean => {
    if (!a || !b) return a === b;
    if (isDateOnly(a) || isDateOnly(b)) return a.trim() === b.trim();
    const ia = instantOf(a, zone);
    const ib = instantOf(b, zone);
    // Two times that cannot be placed are compared as text: the same text is the same time.
    return ia === null || ib === null ? a.trim() === b.trim() : ia === ib;
};

export interface EventWhenInput {
    start: string | null | undefined;
    end?: string | null;
    /** Google's flag; absent = read it from the shape of `start`. */
    allDay?: boolean | null;
    /** The zone a naive time is read in AND every time is printed in. Absent: the browser's zone
     *  (only right for times that carry an offset, which is every time a chip holds). */
    zone?: string | null;
    /** Print the end too (a card does; a chip shows only when it starts). */
    withEnd?: boolean;
    /** Print the weekday ("Tue, Dec 1"). Default true; a chip, which has little room, leaves it out. */
    weekday?: boolean;
}

const dayKey = (instant: number, zone: string | undefined): string =>
    new Intl.DateTimeFormat("en-CA", { timeZone: zone }).format(new Date(instant));

/**
 * "Mon, Dec 1, 10:00 – 10:30", "Mon, Dec 1, 10:00 – Tue, Dec 2, 09:00", "Mon, Dec 1" (all-day) or
 * "Mon, Dec 1 – Wed, Dec 3" in `locale`, or null when the time cannot be read (the caller prints
 * the raw text). The year is added only when it is not this year's.
 */
export const formatEventWhen = (input: EventWhenInput, locale?: string): string | null => {
    const start = input.start?.trim();
    if (!start) return null;
    const withEnd = input.withEnd ?? true;
    const weekday = input.weekday ?? true;
    const allDay = input.allDay ?? isDateOnly(start);
    try {
        if (allDay) return formatDays(start, input.end ?? null, locale, withEnd, weekday);
        const zone = input.zone || undefined;
        const from = instantOf(start, zone);
        if (from === null) return null;
        const to = withEnd ? instantOf(input.end, zone) : null;
        // The year of an instant is the year in the zone it is printed in (just after New Year the
        // browser's year can be the previous one).
        const yearOf = (t: number) =>
            Number(
                new Intl.DateTimeFormat("en-CA", { timeZone: zone, year: "numeric" }).format(t)
            );
        const thisYear = yearOf(Date.now());
        const day = (t: number) =>
            new Intl.DateTimeFormat(locale, {
                ...(weekday ? { weekday: "short" } : {}),
                month: "short",
                day: "numeric",
                ...(yearOf(t) !== thisYear ? { year: "numeric" } : {}),
                timeZone: zone,
            }).format(new Date(t));
        const time = (t: number) =>
            new Intl.DateTimeFormat(locale, {
                hour: "numeric",
                minute: "2-digit",
                timeZone: zone,
            }).format(new Date(t));
        if (to === null) return `${day(from)}, ${time(from)}`;
        if (dayKey(from, zone) === dayKey(to, zone)) {
            return `${day(from)}, ${time(from)} – ${time(to)}`;
        }
        return `${day(from)}, ${time(from)} – ${day(to)}, ${time(to)}`;
    } catch {
        // A zone or locale this runtime does not know.
        return null;
    }
};

const formatDays = (
    start: string,
    end: string | null,
    locale: string | undefined,
    withEnd: boolean,
    weekday: boolean
): string | null => {
    const m = DATE_ONLY.exec(start);
    if (!m) return null;
    const day = (date: string) => {
        const p = DATE_ONLY.exec(date);
        if (!p) return date;
        const t = Date.UTC(+p[1], +p[2] - 1, +p[3]);
        return new Intl.DateTimeFormat(locale, {
            ...(weekday ? { weekday: "short" } : {}),
            month: "short",
            day: "numeric",
            ...(+p[1] !== new Date().getFullYear() ? { year: "numeric" } : {}),
            // A date has no zone: print it as the calendar day it is.
            timeZone: "UTC",
        }).format(new Date(t));
    };
    // Google's all-day end is the day AFTER the last one: one day is [start, start + 1).
    const last = end && isDateOnly(end) ? addDays(end, -1) : start;
    if (!withEnd || last <= start) return day(start);
    return `${day(start)} – ${day(last)}`;
};
