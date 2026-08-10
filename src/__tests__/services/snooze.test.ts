import { describe, expect, it } from "vitest";

import {
    isSnoozedNow,
    msUntilNextBoundary,
    SnoozeSchedule,
    untilNextWeek,
    untilTomorrow,
} from "../../services/notifications/snooze";

// A fixed reference instant so every case is deterministic. This is
// 2026-08-10T12:00:00Z (a Monday) — chosen so `Asia/Tokyo` (UTC+9) reads 21:00
// local and `America/New_York` (UTC-4 in August, DST) reads 08:00 local, which
// lets one `now` exercise both same-day and overnight branches across zones.
const NOON_UTC = Date.parse("2026-08-10T12:00:00Z");

const schedule = (start: string, end: string, enabled = true): SnoozeSchedule => ({
    enabled,
    start,
    end,
});

describe("snooze.isSnoozedNow", () => {
    describe("one-shot snoozeUntil (zone-independent instant)", () => {
        it("is paused while now < until", () => {
            const until = new Date(NOON_UTC + 30 * 60_000).toISOString();
            expect(isSnoozedNow(until, null, "UTC", NOON_UTC)).toBe(true);
        });

        it("is NOT paused once until has passed", () => {
            const until = new Date(NOON_UTC - 1).toISOString();
            expect(isSnoozedNow(until, null, "UTC", NOON_UTC)).toBe(false);
        });

        it("is NOT paused exactly at the boundary (now === until)", () => {
            const until = new Date(NOON_UTC).toISOString();
            expect(isSnoozedNow(until, null, "UTC", NOON_UTC)).toBe(false);
        });

        it("ignores a malformed instant string", () => {
            expect(isSnoozedNow("not-a-date", null, "UTC", NOON_UTC)).toBe(false);
        });

        it("treats null / undefined as no one-shot pause", () => {
            expect(isSnoozedNow(null, null, "UTC", NOON_UTC)).toBe(false);
            expect(isSnoozedNow(undefined, undefined, "UTC", NOON_UTC)).toBe(false);
        });

        it("is zone-independent — the same instant pauses regardless of zone", () => {
            const until = new Date(NOON_UTC + 60_000).toISOString();
            expect(isSnoozedNow(until, null, "Asia/Tokyo", NOON_UTC)).toBe(true);
            expect(isSnoozedNow(until, null, "America/New_York", NOON_UTC)).toBe(true);
        });
    });

    describe("recurring schedule — same-day window (start < end)", () => {
        // 09:00–17:00 UTC; noon UTC is inside.
        it("is paused inside the window", () => {
            expect(isSnoozedNow(null, schedule("09:00", "17:00"), "UTC", NOON_UTC)).toBe(true);
        });

        it("is NOT paused before the window", () => {
            // 13:00–17:00 UTC; noon is before start.
            expect(isSnoozedNow(null, schedule("13:00", "17:00"), "UTC", NOON_UTC)).toBe(false);
        });

        it("is NOT paused at exactly end (half-open [start, end))", () => {
            expect(isSnoozedNow(null, schedule("09:00", "12:00"), "UTC", NOON_UTC)).toBe(false);
        });

        it("is paused at exactly start", () => {
            expect(isSnoozedNow(null, schedule("12:00", "17:00"), "UTC", NOON_UTC)).toBe(true);
        });
    });

    describe("recurring schedule — overnight window (start > end)", () => {
        // 17:00–09:00 UTC spans midnight; noon UTC (12:00) is OUTSIDE.
        it("is NOT paused midday, outside an overnight window", () => {
            expect(isSnoozedNow(null, schedule("17:00", "09:00"), "UTC", NOON_UTC)).toBe(false);
        });

        it("is paused late evening, inside an overnight window", () => {
            const evening = Date.parse("2026-08-10T22:00:00Z");
            expect(isSnoozedNow(null, schedule("17:00", "09:00"), "UTC", evening)).toBe(true);
        });

        it("is paused early morning, inside an overnight window", () => {
            const morning = Date.parse("2026-08-10T06:00:00Z");
            expect(isSnoozedNow(null, schedule("17:00", "09:00"), "UTC", morning)).toBe(true);
        });
    });

    describe("recurring schedule — degenerate / disabled", () => {
        it("start === end is NEVER paused (zero-width means off, not always)", () => {
            expect(isSnoozedNow(null, schedule("09:00", "09:00"), "UTC", NOON_UTC)).toBe(false);
        });

        it("disabled schedule is never paused, even inside the window", () => {
            expect(isSnoozedNow(null, schedule("09:00", "17:00", false), "UTC", NOON_UTC)).toBe(
                false
            );
        });

        it("malformed HH:MM is treated as not paused", () => {
            expect(isSnoozedNow(null, schedule("9:00", "17:00"), "UTC", NOON_UTC)).toBe(false);
            expect(isSnoozedNow(null, schedule("25:00", "26:00"), "UTC", NOON_UTC)).toBe(false);
        });
    });

    describe("recurring schedule — timezone correctness", () => {
        // The window 09:00–17:00 is LOCAL wall-clock. At NOON_UTC:
        //   Asia/Tokyo    reads 21:00 -> outside 09:00–17:00
        //   America/NY    reads 08:00 -> outside 09:00–17:00 (just before start)
        //   UTC           reads 12:00 -> inside
        it("evaluates the window in the given zone, not UTC (Asia/Tokyo)", () => {
            expect(isSnoozedNow(null, schedule("09:00", "17:00"), "Asia/Tokyo", NOON_UTC)).toBe(
                false
            );
        });

        it("evaluates the window in the given zone, not UTC (America/New_York)", () => {
            expect(
                isSnoozedNow(null, schedule("09:00", "17:00"), "America/New_York", NOON_UTC)
            ).toBe(false);
        });

        it("an overnight window that catches Tokyo's 21:00 but not UTC's noon", () => {
            // 20:00–06:00 local: Tokyo (21:00) is IN, UTC (12:00) is OUT.
            expect(isSnoozedNow(null, schedule("20:00", "06:00"), "Asia/Tokyo", NOON_UTC)).toBe(
                true
            );
            expect(isSnoozedNow(null, schedule("20:00", "06:00"), "UTC", NOON_UTC)).toBe(false);
        });

        it("falls back to UTC for an invalid zone name", () => {
            // Bad zone -> safeZone("UTC"); noon UTC is inside 09:00–17:00.
            expect(isSnoozedNow(null, schedule("09:00", "17:00"), "Not/AZone", NOON_UTC)).toBe(
                true
            );
        });
    });

    describe("either form pauses (OR semantics)", () => {
        it("one-shot active, schedule off -> paused", () => {
            const until = new Date(NOON_UTC + 60_000).toISOString();
            expect(isSnoozedNow(until, schedule("00:00", "00:00"), "UTC", NOON_UTC)).toBe(true);
        });

        it("one-shot lapsed, schedule active -> paused", () => {
            const until = new Date(NOON_UTC - 60_000).toISOString();
            expect(isSnoozedNow(until, schedule("09:00", "17:00"), "UTC", NOON_UTC)).toBe(true);
        });
    });
});

describe("snooze.msUntilNextBoundary", () => {
    it("returns null when nothing can flip the state", () => {
        expect(msUntilNextBoundary(null, null, "UTC", NOON_UTC)).toBeNull();
        expect(msUntilNextBoundary(null, schedule("09:00", "17:00", false), "UTC", NOON_UTC)).toBe(
            null
        );
    });

    it("returns the ms to a future one-shot expiry", () => {
        const until = new Date(NOON_UTC + 90_000).toISOString();
        expect(msUntilNextBoundary(until, null, "UTC", NOON_UTC)).toBe(90_000);
    });

    it("ignores a past one-shot expiry", () => {
        const until = new Date(NOON_UTC - 1000).toISOString();
        expect(msUntilNextBoundary(until, null, "UTC", NOON_UTC)).toBeNull();
    });

    it("returns the ms to the next schedule edge (end, while inside)", () => {
        // Inside 09:00–17:00 UTC at 12:00 -> next edge is 17:00 = +5h.
        const ms = msUntilNextBoundary(null, schedule("09:00", "17:00"), "UTC", NOON_UTC);
        expect(ms).toBe(5 * 60 * 60_000);
    });

    it("returns the ms to the next schedule edge (start, while outside)", () => {
        // Outside 13:00–17:00 UTC at 12:00 -> next edge is 13:00 = +1h.
        const ms = msUntilNextBoundary(null, schedule("13:00", "17:00"), "UTC", NOON_UTC);
        expect(ms).toBe(60 * 60_000);
    });

    it("picks the SOONEST of one-shot and schedule edges", () => {
        // One-shot in 90s vs next schedule edge in 5h -> 90s wins.
        const until = new Date(NOON_UTC + 90_000).toISOString();
        const ms = msUntilNextBoundary(until, schedule("09:00", "17:00"), "UTC", NOON_UTC);
        expect(ms).toBe(90_000);
    });

    it("accounts for ms already elapsed into the current minute", () => {
        // 30s past noon: next 13:00 start edge is 1h minus 30s away.
        const t = NOON_UTC + 30_000;
        const ms = msUntilNextBoundary(null, schedule("13:00", "17:00"), "UTC", t);
        expect(ms).toBe(60 * 60_000 - 30_000);
    });
});

describe("snooze duration builders", () => {
    it("untilTomorrow resolves to a future instant at the local resume hour", () => {
        const iso = untilTomorrow("UTC", NOON_UTC);
        const t = Date.parse(iso);
        expect(t).toBeGreaterThan(NOON_UTC);
        // Tomorrow 08:00 UTC from 2026-08-10T12:00Z is 2026-08-11T08:00Z.
        expect(iso).toBe("2026-08-11T08:00:00.000Z");
    });

    it("untilTomorrow respects the zone (Asia/Tokyo 08:00 local = 23:00Z prior day)", () => {
        // Tomorrow in Tokyo local terms: 2026-08-11 08:00 JST = 2026-08-10 23:00Z.
        const iso = untilTomorrow("Asia/Tokyo", NOON_UTC);
        expect(iso).toBe("2026-08-10T23:00:00.000Z");
    });

    it("untilNextWeek lands on the coming Monday at the resume hour", () => {
        // NOON_UTC is Monday 2026-08-10; next Monday is 2026-08-17.
        const iso = untilNextWeek("UTC", NOON_UTC);
        expect(iso).toBe("2026-08-17T08:00:00.000Z");
    });

    it("untilNextWeek is always in the future", () => {
        const t = Date.parse(untilNextWeek("UTC", NOON_UTC));
        expect(t).toBeGreaterThan(NOON_UTC);
    });
});
