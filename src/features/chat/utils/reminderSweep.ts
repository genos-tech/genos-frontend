/**
 * When to re-read reminders so the UI stops promising a nudge already
 * delivered.
 *
 * A pending reminder is the one piece of state here that changes with
 * nobody touching the app: its time arrives, the cron fires it, and the row
 * still says "Reminder: 15:00" until something asks the server again. So
 * each holder of reminders arms ONE timer for the soonest one and re-reads
 * shortly after it passes.
 *
 * Re-read rather than expire the row locally, because the client cannot
 * know what actually happened: the server may have retired the reminder as
 * moot (the to-do was ticked off elsewhere), and the same read picks up
 * anything set on another device.
 *
 * Shared by `ChannelService` (message reminders) and `useTodoGroups`
 * (to-do reminders) — same silence, same bounds, and a divergence would
 * show up only as one surface going quietly stale.
 */

/** The cron drains due reminders every minute, so waiting a little past
 *  the time avoids a round trip that returns the row unchanged. */
export const REMINDER_SWEEP_GRACE_MS = 90_000;

/** A floor, so a reminder the server hasn't drained yet cannot turn into a
 *  tight polling loop. */
export const REMINDER_SWEEP_MIN_MS = 60_000;

/** `setTimeout` overflows past ~24.8 days and would fire immediately, so a
 *  reminder set for next month re-arms instead of firing now. */
export const REMINDER_SWEEP_MAX_MS = 6 * 60 * 60 * 1000;

/**
 * How long to wait before re-reading, given the pending reminders' instants
 * (ISO strings). Null when there is nothing outstanding — no reminders, no
 * timer.
 *
 * Unparseable instants are ignored rather than treated as "now": a bad row
 * must not arm a permanent one-minute poll.
 */
export const reminderSweepDelayMs = (
    remindAtValues: Iterable<string>,
    now: number = Date.now()
): number | null => {
    let soonest = Number.POSITIVE_INFINITY;
    for (const value of remindAtValues) {
        const at = Date.parse(value);
        if (!Number.isNaN(at) && at < soonest) soonest = at;
    }
    if (!Number.isFinite(soonest)) return null;
    return Math.min(
        Math.max(soonest + REMINDER_SWEEP_GRACE_MS - now, REMINDER_SWEEP_MIN_MS),
        REMINDER_SWEEP_MAX_MS
    );
};
