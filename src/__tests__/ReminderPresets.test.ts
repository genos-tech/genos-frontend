/**
 * Reminder preset math — what "later" resolves to.
 *
 * These run in the browser's local timezone on purpose: the whole reason
 * presets are computed client-side is that only the browser knows which
 * 9am the user means (see the module docstring in `reminderPresets.ts`).
 * The assertions are therefore about LOCAL wall-clock fields, never UTC.
 */

import { describe, expect, it } from "vitest";

import {
    formatReminderTime,
    fromDatetimeLocalValue,
    isUsableReminderTime,
    MORNING_HOUR,
    presetTime,
    reminderPresets,
    toDatetimeLocalValue,
} from "../features/chat/utils/reminderPresets";

// A Wednesday, mid-afternoon local time.
const wednesday = () => new Date(2026, 7, 5, 14, 30, 0, 0);

describe("presetTime", () => {
    it("offsets the clock for the relative presets", () => {
        const from = wednesday();
        expect(presetTime("in20m", from).getTime() - from.getTime()).toBe(20 * 60 * 1000);
        expect(presetTime("in1h", from).getTime() - from.getTime()).toBe(60 * 60 * 1000);
        expect(presetTime("in3h", from).getTime() - from.getTime()).toBe(3 * 60 * 60 * 1000);
    });

    it("puts tomorrow at local morning, not 24 hours out", () => {
        const at = presetTime("tomorrow", wednesday());
        expect(at.getDate()).toBe(6);
        expect(at.getHours()).toBe(MORNING_HOUR);
        expect(at.getMinutes()).toBe(0);
    });

    it("rolls tomorrow across a month boundary", () => {
        const at = presetTime("tomorrow", new Date(2026, 7, 31, 23, 45));
        expect(at.getMonth()).toBe(8);
        expect(at.getDate()).toBe(1);
        expect(at.getHours()).toBe(MORNING_HOUR);
    });

    it("resolves next week to the coming Monday morning", () => {
        const at = presetTime("nextWeek", wednesday());
        expect(at.getDay()).toBe(1);
        expect(at.getDate()).toBe(10);
        expect(at.getHours()).toBe(MORNING_HOUR);
    });

    it("means the FOLLOWING Monday when today is Monday", () => {
        // Monday 2026-08-10, before the morning hour: "next week" must not
        // resolve to a time earlier today.
        const monday = new Date(2026, 7, 10, 8, 0);
        const at = presetTime("nextWeek", monday);
        expect(at.getDate()).toBe(17);
        expect(at.getTime()).toBeGreaterThan(monday.getTime());
    });

    it("resolves every preset into the future, in soonest-first order", () => {
        const from = wednesday();
        const times = reminderPresets(from).map((p) => p.at.getTime());
        expect(times.every((ms) => ms > from.getTime())).toBe(true);
        expect([...times].sort((a, b) => a - b)).toEqual(times);
    });
});

describe("formatReminderTime", () => {
    const now = wednesday();

    it("shows the time alone later the same day", () => {
        const at = new Date(2026, 7, 5, 17, 15);
        const out = formatReminderTime(at, "en", now);
        expect(out).toMatch(/17:15|5:15/);
        expect(out).not.toMatch(/Aug|Wed/);
    });

    it("names the weekday within the coming week", () => {
        expect(formatReminderTime(new Date(2026, 7, 7, 9, 0), "en", now)).toMatch(/Fri/);
    });

    it("falls back to a date beyond a week out", () => {
        expect(formatReminderTime(new Date(2026, 8, 20, 9, 0), "en", now)).toMatch(/Sep/);
    });
});

describe("datetime-local round trip", () => {
    it("keeps local wall-clock digits, not UTC", () => {
        const at = new Date(2026, 7, 5, 9, 5);
        expect(toDatetimeLocalValue(at)).toBe("2026-08-05T09:05");
        expect(fromDatetimeLocalValue("2026-08-05T09:05")?.getTime()).toBe(at.getTime());
    });

    it("reads an empty or unparseable value as no time at all", () => {
        expect(fromDatetimeLocalValue("")).toBeNull();
        expect(fromDatetimeLocalValue("not a date")).toBeNull();
    });
});

describe("isUsableReminderTime", () => {
    const now = wednesday();

    it("accepts a future time inside the horizon", () => {
        expect(isUsableReminderTime(new Date(now.getTime() + 60_000), now)).toBe(true);
    });

    it("rejects nothing, the past, and beyond the horizon", () => {
        expect(isUsableReminderTime(null, now)).toBe(false);
        expect(isUsableReminderTime(new Date(now.getTime() - 1000), now)).toBe(false);
        expect(isUsableReminderTime(new Date(now.getTime() + 400 * 24 * 3600_000), now)).toBe(
            false
        );
    });
});
