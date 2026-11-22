// A task's start / due date and a sprint's window are CALENDAR days ("2026-12-02"), not
// instants: the same day on every screen, in every time zone. `new Date("2026-12-02")` is UTC
// midnight, and reading it with the local getters (`getDate()`, `setHours(0, 0, 0, 0)`,
// `toLocaleDateString`) gives Dec 1 for anyone west of UTC, so a card said "due yesterday"
// the day it was due (MIP-1811). Build the date from its parts instead: local midnight.
//
// A React-free leaf on purpose (no i18n barrel import): `dateUtils` is reachable from web
// workers, and so can this be.

import type { Locale } from "../i18n/types";

const CALENDAR_DATE = /^(\d{4})-(\d{2})-(\d{2})/;

/**
 * The calendar day of a `YYYY-MM-DD` string (a longer ISO timestamp counts by its first ten
 * characters, as the callers always did) as LOCAL midnight. `null` for an empty, malformed or
 * impossible date ("2026-02-31").
 */
export const parseCalendarDate = (iso: string | null | undefined): Date | null => {
    if (!iso) return null;
    const match = CALENDAR_DATE.exec(iso);
    if (!match) return null;
    const year = Number(match[1]);
    const month = Number(match[2]) - 1;
    const day = Number(match[3]);
    const date = new Date(year, month, day);
    // `new Date(2026, 1, 31)` rolls over to Mar 3: an impossible date stays invalid.
    if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) {
        return null;
    }
    return date;
};

/** Whole days from the viewer's today to that calendar day (negative = past); `null` when unparseable. */
export const calendarDaysUntil = (
    iso: string | null | undefined,
    now: Date = new Date()
): number | null => {
    const due = parseCalendarDate(iso);
    if (due == null) return null;
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    // `round`: a day is 23 or 25 hours long across a daylight-saving change.
    return Math.round((due.getTime() - today.getTime()) / 86_400_000);
};

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** `YYYY-MM-DD` of a date's LOCAL calendar day (`toISOString()` would give the UTC day, MIP-1898). */
export const localCalendarIso = (date: Date): string =>
    `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;

/** The viewer's today as `YYYY-MM-DD`, in their own time zone. */
export const todayCalendarIso = (now: Date = new Date()): string => localCalendarIso(now);

/** Local midnight of the viewer's today, in ms. */
export const startOfTodayMs = (now: Date = new Date()): number =>
    new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();

/**
 * A due / start / end date as the ms of its calendar day's LOCAL midnight, comparable with
 * `startOfTodayMs()`: a day is "past" when this is `< startOfTodayMs()`, so a task due today is
 * not overdue (MIP-1816). An unparseable string falls back to `new Date(iso).getTime()` (NaN
 * when empty), as the callers always did.
 */
export const calendarDayMs = (iso: string): number =>
    (parseCalendarDate(iso) ?? new Date(iso)).getTime();

/** "Dec 2" in the app's language (`locale` from `useTranslation()`); `null` when unparseable. */
export const formatMonthDay = (iso: string | null | undefined, locale: Locale): string | null => {
    const date = parseCalendarDate(iso);
    return date == null
        ? null
        : date.toLocaleDateString(locale, { month: "short", day: "numeric" });
};
