/**
 * `occursOn` — the client-side RRULE expansion that drives todo
 * materialization. Table-tested because every branch is a date off-by-one
 * that only misfires at a week/month boundary:
 *
 *  - interval counts from `startDate`, not an arbitrary epoch
 *  - weekly with empty byWeekday falls back to the start's weekday
 *  - a target before the start, or past an end, never occurs
 *  - monthly/yearly don't fire in periods that lack the anchor day
 *    (Jan 31 → no Feb occurrence)
 */

import { describe, expect, it } from "vitest";

import { DEFAULT_RECURRENCE, type RecurrenceSpec } from "../features/calendar/utils/rrule";
import { occursOn } from "../features/chat/utils/todoSchedule";

const spec = (over: Partial<RecurrenceSpec> = {}): RecurrenceSpec => ({
    ...DEFAULT_RECURRENCE,
    ...over,
});

// 2026-08-08 is a Saturday. Anchor most cases here.
const SAT = "2026-08-08";

describe("occursOn — none", () => {
    it("never occurs for a non-repeating spec", () => {
        expect(occursOn(spec({ frequency: "none" }), SAT, SAT)).toBe(false);
    });
});

describe("occursOn — daily", () => {
    it("occurs on the start date", () => {
        expect(occursOn(spec({ frequency: "daily" }), SAT, SAT)).toBe(true);
    });
    it("occurs the next day", () => {
        expect(occursOn(spec({ frequency: "daily" }), SAT, "2026-08-09")).toBe(true);
    });
    it("never occurs before the start", () => {
        expect(occursOn(spec({ frequency: "daily" }), SAT, "2026-08-07")).toBe(false);
    });
    it("honors interval (every 3 days)", () => {
        const s = spec({ frequency: "daily", interval: 3 });
        expect(occursOn(s, SAT, "2026-08-08")).toBe(true); // day 0
        expect(occursOn(s, SAT, "2026-08-09")).toBe(false); // day 1
        expect(occursOn(s, SAT, "2026-08-11")).toBe(true); // day 3
    });
});

describe("occursOn — weekly", () => {
    it("defaults to the start's weekday when byWeekday empty", () => {
        const s = spec({ frequency: "weekly" }); // start is Saturday
        expect(occursOn(s, SAT, SAT)).toBe(true);
        expect(occursOn(s, SAT, "2026-08-15")).toBe(true); // next Saturday
        expect(occursOn(s, SAT, "2026-08-10")).toBe(false); // Monday
    });
    it("fires only on selected weekdays (every Monday)", () => {
        // 1 = Monday. Start on Saturday, first Monday is 2026-08-10.
        const s = spec({ frequency: "weekly", byWeekday: [1] });
        expect(occursOn(s, SAT, "2026-08-10")).toBe(true); // Monday
        expect(occursOn(s, SAT, "2026-08-17")).toBe(true); // next Monday
        expect(occursOn(s, SAT, "2026-08-11")).toBe(false); // Tuesday
        expect(occursOn(s, SAT, SAT)).toBe(false); // Saturday
    });
    it("supports multiple weekdays (Mon + Wed)", () => {
        const s = spec({ frequency: "weekly", byWeekday: [1, 3] });
        expect(occursOn(s, SAT, "2026-08-10")).toBe(true); // Mon
        expect(occursOn(s, SAT, "2026-08-12")).toBe(true); // Wed
        expect(occursOn(s, SAT, "2026-08-11")).toBe(false); // Tue
    });
    it("honors interval (every other Monday)", () => {
        // Start Sat 08-08 (week 0). Mondays: 08-10 (week 0), 08-17 (week 1),
        // 08-24 (week 2). interval 2 → weeks 0 and 2 fire, week 1 skipped.
        const s = spec({ frequency: "weekly", byWeekday: [1], interval: 2 });
        expect(occursOn(s, SAT, "2026-08-10")).toBe(true); // week 0
        expect(occursOn(s, SAT, "2026-08-17")).toBe(false); // week 1
        expect(occursOn(s, SAT, "2026-08-24")).toBe(true); // week 2
    });
});

describe("occursOn — monthly", () => {
    it("fires on the same day-of-month each month", () => {
        const s = spec({ frequency: "monthly" });
        expect(occursOn(s, SAT, SAT)).toBe(true);
        expect(occursOn(s, SAT, "2026-09-08")).toBe(true);
        expect(occursOn(s, SAT, "2026-09-09")).toBe(false);
    });
    it("honors interval (every 2 months)", () => {
        const s = spec({ frequency: "monthly", interval: 2 });
        expect(occursOn(s, SAT, "2026-09-08")).toBe(false); // +1 month
        expect(occursOn(s, SAT, "2026-10-08")).toBe(true); // +2 months
    });
    it("does not fire in months lacking the anchor day (31st)", () => {
        const s = spec({ frequency: "monthly" });
        expect(occursOn(s, "2026-01-31", "2026-01-31")).toBe(true);
        expect(occursOn(s, "2026-01-31", "2026-02-28")).toBe(false); // no Feb 31
        expect(occursOn(s, "2026-01-31", "2026-03-31")).toBe(true);
    });
});

describe("occursOn — yearly", () => {
    it("fires on the same month+day each year", () => {
        const s = spec({ frequency: "yearly" });
        expect(occursOn(s, SAT, "2027-08-08")).toBe(true);
        expect(occursOn(s, SAT, "2027-08-09")).toBe(false);
        expect(occursOn(s, SAT, "2026-09-08")).toBe(false);
    });
});

describe("occursOn — end conditions", () => {
    it("stops after an inclusive onDate", () => {
        const s = spec({ frequency: "daily", end: { kind: "onDate", date: "2026-08-10" } });
        expect(occursOn(s, SAT, "2026-08-10")).toBe(true); // inclusive last day
        expect(occursOn(s, SAT, "2026-08-11")).toBe(false);
    });
    it("stops after N occurrences (daily)", () => {
        const s = spec({ frequency: "daily", end: { kind: "afterCount", count: 3 } });
        expect(occursOn(s, SAT, "2026-08-08")).toBe(true); // #1
        expect(occursOn(s, SAT, "2026-08-10")).toBe(true); // #3
        expect(occursOn(s, SAT, "2026-08-11")).toBe(false); // #4 — past count
    });
    it("stops after N occurrences (weekly, single day)", () => {
        // Every Monday, 2 times: 08-10 (#1), 08-17 (#2), 08-24 (#3, past).
        const s = spec({
            frequency: "weekly",
            byWeekday: [1],
            end: { kind: "afterCount", count: 2 },
        });
        expect(occursOn(s, SAT, "2026-08-10")).toBe(true);
        expect(occursOn(s, SAT, "2026-08-17")).toBe(true);
        expect(occursOn(s, SAT, "2026-08-24")).toBe(false);
    });
    it("counts each weekday separately (Mon+Wed, 3 times)", () => {
        // Occurrences: Mon 08-10 (#1), Wed 08-12 (#2), Mon 08-17 (#3),
        // Wed 08-19 (#4, past the count of 3).
        const s = spec({
            frequency: "weekly",
            byWeekday: [1, 3],
            end: { kind: "afterCount", count: 3 },
        });
        expect(occursOn(s, SAT, "2026-08-10")).toBe(true);
        expect(occursOn(s, SAT, "2026-08-12")).toBe(true);
        expect(occursOn(s, SAT, "2026-08-17")).toBe(true);
        expect(occursOn(s, SAT, "2026-08-19")).toBe(false);
    });
});

describe("occursOn — invalid input", () => {
    it("returns false on unparseable dates", () => {
        expect(occursOn(spec({ frequency: "daily" }), "not-a-date", SAT)).toBe(false);
        expect(occursOn(spec({ frequency: "daily" }), SAT, "not-a-date")).toBe(false);
    });
});
