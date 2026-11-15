/**
 * Reading and printing an event's times (MIP-1059).
 *
 * The agent's `start_iso` / `end_iso` are NAIVE local times: the wall clock in the call's `time_zone`,
 * else the member's zone. Read with `new Date()` they would take the BROWSER's zone, which is wrong for
 * anyone whose browser is not in their Genos zone. These pin that a naive time becomes the right
 * instant in the named zone (across a daylight-saving change too), that two times are compared as
 * instants and not as strings, and that an all-day event's exclusive end reads as one day.
 */

import { describe, expect, it, vi } from "vitest";

import {
    formatEventWhen,
    instantOf,
    isDateOnly,
    sameWhen,
} from "../features/calendar/utils/eventWhen";

const utc = (iso: string) => Date.parse(iso);

describe("instantOf", () => {
    it("reads a naive time in the zone named, not the browser's", () => {
        expect(instantOf("2026-12-01T10:00:00", "Asia/Tokyo")).toBe(utc("2026-12-01T01:00:00Z"));
        expect(instantOf("2026-12-01T10:00", "America/Los_Angeles")).toBe(
            utc("2026-12-01T18:00:00Z")
        );
    });

    it("follows daylight saving on the date in question", () => {
        // Los Angeles is UTC-8 in December and UTC-7 in July.
        expect(instantOf("2026-07-01T10:00:00", "America/Los_Angeles")).toBe(
            utc("2026-07-01T17:00:00Z")
        );
    });

    it("takes an offset or Z as exact and ignores the zone", () => {
        expect(instantOf("2026-12-01T10:00:00+09:00", "America/New_York")).toBe(
            utc("2026-12-01T01:00:00Z")
        );
        expect(instantOf("2026-12-01T01:00:00Z")).toBe(utc("2026-12-01T01:00:00Z"));
    });

    it("has no instant for a date, an unreadable value, or a naive time with no usable zone", () => {
        expect(instantOf("2026-12-01", "Asia/Tokyo")).toBeNull();
        expect(instantOf("soon", "Asia/Tokyo")).toBeNull();
        expect(instantOf("2026-12-01T10:00:00")).toBeNull();
        expect(instantOf("2026-12-01T10:00:00", "Not/AZone")).toBeNull();
    });
});

describe("a naive time with fractional seconds (MIP-1586)", () => {
    it("is still a naive time: read in the zone named, not the browser's", () => {
        // `2026-12-01T10:00:00.000` is what a JS `toISOString()` without the Z or a Python
        // `isoformat(timespec="milliseconds")` on a naive datetime gives. It has no offset.
        expect(instantOf("2026-12-01T10:00:00.000", "Asia/Tokyo")).toBe(
            utc("2026-12-01T01:00:00Z")
        );
        expect(instantOf("2026-12-01T10:00:00.000", "America/Los_Angeles")).toBe(
            utc("2026-12-01T18:00:00Z")
        );
        // The fraction is kept (to the millisecond), not dropped.
        expect(instantOf("2026-12-01T10:00:00.5", "America/Los_Angeles")).toBe(
            utc("2026-12-01T18:00:00.5Z")
        );
        expect(instantOf("2026-12-01 10:00:00.000", "Asia/Tokyo")).toBe(
            utc("2026-12-01T01:00:00Z")
        );
    });

    it("has no instant without a usable zone, like the same time without the fraction", () => {
        expect(instantOf("2026-12-01T10:00:00.000")).toBeNull();
        expect(instantOf("2026-12-01T10:00:00.000", "Not/AZone")).toBeNull();
    });

    it("still takes an offset or Z after the fraction as exact", () => {
        expect(instantOf("2026-12-01T10:00:00.000+09:00", "America/New_York")).toBe(
            utc("2026-12-01T01:00:00Z")
        );
        expect(instantOf("2026-12-01T01:00:00.000Z")).toBe(utc("2026-12-01T01:00:00Z"));
    });

    it("compares and prints like the same time without the fraction", () => {
        expect(
            sameWhen("2026-12-01T10:00:00.000", "2026-12-01T10:00:00+09:00", "Asia/Tokyo")
        ).toBe(true);
        expect(
            sameWhen("2026-12-01T10:00:00.000", "2026-12-01T10:00:00-08:00", "America/Los_Angeles")
        ).toBe(true);
        for (const zone of ["Asia/Tokyo", "America/Los_Angeles"]) {
            expect(
                formatEventWhen(
                    {
                        start: "2026-12-01T10:00:00.000",
                        end: "2026-12-01T10:30:00.000",
                        zone,
                    },
                    "en-US"
                )
            ).toBe(
                formatEventWhen(
                    { start: "2026-12-01T10:00:00", end: "2026-12-01T10:30:00", zone },
                    "en-US"
                )
            );
        }
    });
});

describe("sameWhen", () => {
    it("compares instants: the same moment in two spellings is the same time", () => {
        // 10:00 in Tokyo is 01:00Z: strings differ, the moment does not.
        expect(sameWhen("2026-12-01T10:00:00", "2026-12-01T01:00:00Z", "Asia/Tokyo")).toBe(true);
        expect(sameWhen("2026-12-01T10:00:00", "2026-12-01T10:00:00+09:00", "Asia/Tokyo")).toBe(
            true
        );
        // The same wall clock in another zone is a different moment.
        expect(sameWhen("2026-12-01T10:00:00", "2026-12-01T10:00:00+00:00", "Asia/Tokyo")).toBe(
            false
        );
    });

    it("compares dates as dates", () => {
        expect(sameWhen("2026-12-01", "2026-12-01")).toBe(true);
        expect(sameWhen("2026-12-01", "2026-12-02")).toBe(false);
        expect(sameWhen("2026-12-01", "2026-12-01T00:00:00Z")).toBe(false);
    });
});

describe("formatEventWhen", () => {
    it("prints a timed event in the zone given, as a range on one day", () => {
        const text = formatEventWhen(
            { start: "2026-12-01T01:00:00Z", end: "2026-12-01T01:30:00Z", zone: "Asia/Tokyo" },
            "en-US"
        );
        expect(text).toContain("Dec 1");
        expect(text).toMatch(/10:00\s?AM/);
        expect(text).toMatch(/10:30\s?AM/);
        // The browser's zone (UTC in CI, anywhere else on a laptop) is not what was asked for.
        expect(text).not.toMatch(/1:00\s?AM/);
    });

    it("reads a naive proposal in the member's zone", () => {
        const text = formatEventWhen(
            { start: "2026-12-01T09:00:00", end: "2026-12-01T10:00:00", zone: "America/New_York" },
            "en-US"
        );
        expect(text).toMatch(/9:00\s?AM/);
        expect(text).toMatch(/10:00\s?AM/);
    });

    it("names both days of an event that crosses midnight", () => {
        const text = formatEventWhen(
            { start: "2026-12-01T22:00:00", end: "2026-12-02T01:00:00", zone: "Asia/Tokyo" },
            "en-US"
        );
        expect(text).toContain("Dec 1");
        expect(text).toContain("Dec 2");
    });

    it("reads an all-day end as exclusive: one day, and a range of three", () => {
        const one = formatEventWhen(
            { start: "2026-12-01", end: "2026-12-02", allDay: true },
            "en-US"
        );
        expect(one).toContain("Dec 1");
        expect(one).not.toContain("Dec 2");
        expect(one).not.toContain("–");
        const three = formatEventWhen({ start: "2026-12-01", end: "2026-12-04" }, "en-US");
        expect(three).toContain("Dec 1");
        expect(three).toContain("Dec 3");
        expect(three).not.toContain("Dec 4");
    });

    it("prints a date as the calendar day it is, whatever the browser's zone", () => {
        expect(formatEventWhen({ start: "2026-12-01", withEnd: false }, "en-US")).toContain(
            "Dec 1"
        );
    });

    it("takes the year in the zone it prints in, not the browser's", () => {
        // It is already 2027 in Tokyo (05:00 on 1 January) while the browser's own zone (UTC here) is
        // still on 31 December 2026: an event in Tokyo on 1 January is "this year", with no year.
        vi.useFakeTimers();
        vi.setSystemTime(new Date("2026-12-31T20:00:00Z"));
        try {
            const text = formatEventWhen(
                { start: "2027-01-01T09:00:00", zone: "Asia/Tokyo", withEnd: false },
                "en-US"
            );
            expect(text).toContain("Jan 1");
            expect(text).not.toContain("2027");
        } finally {
            vi.useRealTimers();
        }
    });

    it("leaves the weekday out when asked", () => {
        const text = formatEventWhen(
            { start: "2026-12-01T01:00:00Z", zone: "UTC", withEnd: false, weekday: false },
            "en-US"
        );
        expect(text).not.toMatch(/Tue/);
        expect(text).toContain("Dec 1");
    });

    it("shows only the start when asked (a chip)", () => {
        const text = formatEventWhen(
            {
                start: "2026-12-01T01:00:00Z",
                end: "2026-12-01T05:00:00Z",
                zone: "UTC",
                withEnd: false,
            },
            "en-US"
        );
        expect(text).not.toContain("–");
    });

    it("is null for what cannot be read, so the caller prints the text", () => {
        expect(formatEventWhen({ start: "" })).toBeNull();
        expect(formatEventWhen({ start: "2026-12-01T10:00:00", zone: "Not/AZone" })).toBeNull();
        expect(formatEventWhen({ start: "2026-12-01T10:00:00" })).toBeNull();
    });
});

describe("isDateOnly", () => {
    it("tells an all-day value from a timed one", () => {
        expect(isDateOnly("2026-12-01")).toBe(true);
        expect(isDateOnly("2026-12-01T10:00:00")).toBe(false);
    });
});
