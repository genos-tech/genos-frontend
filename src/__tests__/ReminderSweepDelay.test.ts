/**
 * `reminderSweepDelayMs` — when to re-read a pending-reminder set.
 *
 * Only the server knows what a reminder BECAME: fired, or retired as moot
 * (its to-do was ticked off). So the client never expires a reminder
 * locally; it waits for the soonest one's time to pass and re-reads. This
 * shared helper is what both reminder kinds time that re-read with — the
 * message set in `ChannelService` and the to-do set in `useTodoGroups` — so
 * the two can't drift into different ideas of "the reminder is stale now".
 */
import { describe, expect, it } from "vitest";

import {
    REMINDER_SWEEP_GRACE_MS,
    REMINDER_SWEEP_MAX_MS,
    REMINDER_SWEEP_MIN_MS,
    reminderSweepDelayMs,
} from "../features/chat/utils/reminderSweep";

const NOW = Date.parse("2026-08-16T12:00:00Z");
const at = (msFromNow: number) => new Date(NOW + msFromNow).toISOString();

describe("reminderSweepDelayMs", () => {
    it("returns null when there is nothing pending — no timer to arm", () => {
        expect(reminderSweepDelayMs([], NOW)).toBeNull();
    });

    it("waits for the SOONEST reminder, not the first or last given", () => {
        const hour = 60 * 60 * 1000;
        const delay = reminderSweepDelayMs([at(3 * hour), at(hour), at(5 * hour)], NOW);
        expect(delay).toBe(hour + REMINDER_SWEEP_GRACE_MS);
    });

    it("adds the grace period, so the re-read lands AFTER the cron has fired it", () => {
        // The minutely tick delivers at the whole minute; re-reading at the
        // reminder's own instant would race it and see the row still
        // pending, leaving the UI promising a nudge already sent.
        const delay = reminderSweepDelayMs([at(10 * 60 * 1000)], NOW);
        expect(delay).toBeGreaterThan(10 * 60 * 1000);
    });

    it("floors an overdue reminder at the minimum rather than firing at once", () => {
        // An already-past remind_at means the cron hasn't got to it yet (or
        // its delivery hasn't reached us). Re-reading immediately — and then
        // again, and again — would be a hot loop against the API.
        expect(reminderSweepDelayMs([at(-3 * 60 * 60 * 1000)], NOW)).toBe(REMINDER_SWEEP_MIN_MS);
    });

    it("caps a distant reminder, so a long-lived tab keeps checking in", () => {
        const year = 365 * 24 * 60 * 60 * 1000;
        expect(reminderSweepDelayMs([at(year)], NOW)).toBe(REMINDER_SWEEP_MAX_MS);
    });

    it("ignores unparseable instants instead of arming on NaN", () => {
        const hour = 60 * 60 * 1000;
        expect(reminderSweepDelayMs(["not a date", at(hour)], NOW)).toBe(
            hour + REMINDER_SWEEP_GRACE_MS
        );
        expect(reminderSweepDelayMs(["not a date"], NOW)).toBeNull();
    });
});
