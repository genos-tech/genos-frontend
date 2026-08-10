/**
 * The client half of the Slack-style "clear status after" feature for a user's
 * CUSTOM STATUS (the emoji + message like "🌴 On Holiday" — not online/offline
 * presence, and not the private notification pause).
 *
 * Design mirrors the notification-snooze predicate in `snooze.ts`: the expiry
 * instant (`customStatusExpiry`, an absolute UTC ISO string) is the single
 * source of truth, and every reader evaluates "is it still valid?" lazily at
 * read time. There is no server tick. A past expiry means the status is
 * expired: viewers mask it (`isStatusExpired`), and the OWNER's own client arms
 * a timer (`msUntilStatusExpiry`) to PUT-clear both fields so the DB converges.
 *
 * Unlike snooze, the expiry is one absolute instant (no recurring schedule) and
 * is visible to everyone, so `formatStatusExpiry` renders the moment teammates
 * read as "until Tue 9:00 AM".
 *
 * The LOCAL wall-clock presets (Today / This week) reuse the exact same DST-safe
 * zone math the snooze presets use — imported, not re-derived.
 */

import { localDateParts, localWeekday, safeZone, wallClockToEpoch } from "./snooze";

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;

/** Is the status expired right now? True only when an expiry is set AND the
 *  instant has passed. `null`/absent/malformed → never expired (the status
 *  simply persists), matching "no expiry set". */
export const isStatusExpired = (
    expiry: string | null | undefined,
    now: number = Date.now()
): boolean => {
    if (!expiry) return false;
    const t = Date.parse(expiry);
    if (Number.isNaN(t)) return false;
    return now >= t;
};

/** ms from `now` until the status expires, or `null` if there is no future
 *  expiry (unset, malformed, or already elapsed). Drives the owner's reactive
 *  auto-clear `setTimeout`, the same way `msUntilNextBoundary` drives the
 *  pause hook's expiry timer. */
export const msUntilStatusExpiry = (
    expiry: string | null | undefined,
    now: number = Date.now()
): number | null => {
    if (!expiry) return null;
    const t = Date.parse(expiry);
    if (Number.isNaN(t) || t <= now) return null;
    return t - now;
};

// ----- Duration builders — each returns an absolute UTC ISO instant ---------

/** A fixed duration from now (30 min / 1 h / 4 h). Zone-independent — it's an
 *  offset from an instant, not a wall-clock time. */
export const statusExpiryIn = (ms: number, now: number = Date.now()): string =>
    new Date(now + ms).toISOString();

/** End of today, local: the coming local midnight (00:00 of tomorrow) in the
 *  user's zone. Slack's "Today". */
export const statusExpiryEndOfToday = (zone: string = "UTC", now: number = Date.now()): string => {
    const z = safeZone(zone);
    const { year, month, day } = localDateParts(z, new Date(now));
    // day + 1 at 00:00 is the end of today (out-of-range day normalises via
    // Date.UTC inside wallClockToEpoch — day 32 → the 1st of next month).
    return new Date(wallClockToEpoch(z, year, month, day + 1, 0, 0)).toISOString();
};

/** End of the coming Friday, local. Slack's "This week". If today is already
 *  Friday it means end of TODAY (Friday), not a week away; on the weekend the
 *  coming Friday is next week's — the work week has passed. */
export const statusExpiryEndOfThisWeek = (
    zone: string = "UTC",
    now: number = Date.now()
): string => {
    const z = safeZone(zone);
    const d = new Date(now);
    const { year, month, day } = localDateParts(z, d);
    const daysToFriday = (5 - localWeekday(z, d) + 7) % 7; // 5 = Friday
    // + 1 → 00:00 of the day AFTER Friday, i.e. the end of Friday.
    return new Date(wallClockToEpoch(z, year, month, day + daysToFriday + 1, 0, 0)).toISOString();
};

// Named durations so the UI and tests share one definition.
export const STATUS_EXPIRY_30M = 30 * MINUTE;
export const STATUS_EXPIRY_1H = HOUR;
export const STATUS_EXPIRY_4H = 4 * HOUR;

/**
 * Render an expiry instant for display, in the viewer's local wall-clock (it
 * IS an instant, so local time is what everyone reads off their own clock).
 * The weekday is shown only when the moment isn't today, so a short expiry
 * reads "3:30 PM" while a holiday reads "Tue 9:00 AM". Returns "" for a
 * missing/malformed value so callers can fall back cleanly.
 *
 * Shared with the notification-pause status line (`NotificationPausePicker`),
 * which formats its one-shot `snoozeUntil` the same way.
 */
export const formatStatusExpiry = (iso: string | null | undefined): string => {
    if (!iso) return "";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const now = new Date();
    const sameDay =
        d.getFullYear() === now.getFullYear() &&
        d.getMonth() === now.getMonth() &&
        d.getDate() === now.getDate();
    return d.toLocaleString(
        undefined,
        sameDay
            ? { hour: "numeric", minute: "2-digit" }
            : { weekday: "short", hour: "numeric", minute: "2-digit" }
    );
};

/** `Date` → the `YYYY-MM-DDTHH:MM` string a `datetime-local` input wants, in
 *  local wall-clock (exactly how the input reads it back). Shared with the
 *  pause custom-datetime picker. */
export const toLocalInputValue = (d: Date): string => {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
        d.getHours()
    )}:${pad(d.getMinutes())}`;
};
