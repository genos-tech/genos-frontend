import dayjs from "dayjs";

// Helpers for Google Calendar all-day (date-only) events.
//
// Google represents an all-day event with `start.date` / `end.date`
// (YYYY-MM-DD) and — critically — an EXCLUSIVE end: a single all-day event
// on Jul 14 is `{ start.date: "2026-07-14", end.date: "2026-07-15" }`. The
// event form instead shows an INCLUSIVE last day (what the user thinks of
// as "ends on"), so we convert on the way in and out.
//
// All math goes through dayjs: `dayjs("2026-07-14")` is LOCAL midnight
// (unlike `new Date("2026-07-14")`, which is UTC and can shift the day by
// one depending on the viewer's timezone), so add/subtract-day + format is
// timezone-stable. Keep the all-day path free of bare `new Date(str)`.

/** Google's exclusive `end.date` → the inclusive last day shown in the form. */
export const googleEndToInclusive = (endDate: string): string =>
    dayjs(endDate).subtract(1, "day").format("YYYY-MM-DD");

/** The form's inclusive last day → Google's exclusive `end.date` for submit. */
export const inclusiveToGoogleEnd = (endDate: string): string =>
    dayjs(endDate).add(1, "day").format("YYYY-MM-DD");

/** Date part of a `datetime-local` ("2026-07-14T09:30") or a bare date. */
export const dateOnly = (value: string): string => value.slice(0, 10);
