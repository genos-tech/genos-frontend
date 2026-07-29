/**
 * Start/end auto-shift for timed calendar events.
 *
 * One rule underlies both directions: the event keeps the length it
 * already had. Moving the start drags the end along; setting an end at
 * or before the start backs the start up rather than saving a negative
 * event.
 *
 * The no-op cases matter as much as the shifts — `datetime-local` fires
 * `onChange` with empty and half-typed values while the user types, and
 * a naive handler makes the other field lurch around or go blank.
 */

import { describe, expect, it } from "vitest";

import {
    endForNewStart,
    formatLocalInput,
    parseLocalInput,
    startForNewEnd,
} from "../features/calendar/utils/timedRange";

describe("endForNewStart", () => {
    it("moves the end by an hour when the start moves and the event is an hour", () => {
        // The seeded default: 9pm–10pm. Start → 9pm means end → 10pm.
        expect(endForNewStart("2026-07-29T20:00", "2026-07-29T21:00", "2026-07-29T21:00")).toBe(
            "2026-07-29T22:00"
        );
    });

    it("preserves a non-hour duration instead of forcing 60 minutes", () => {
        // A 30-minute stand-up stays 30 minutes when it's moved.
        expect(endForNewStart("2026-07-29T09:00", "2026-07-29T09:30", "2026-07-29T14:00")).toBe(
            "2026-07-29T14:30"
        );
    });

    it("carries a multi-day span along", () => {
        expect(endForNewStart("2026-07-29T09:00", "2026-07-31T09:00", "2026-08-01T09:00")).toBe(
            "2026-08-03T09:00"
        );
    });

    it("rolls the end over midnight rather than clamping to the day", () => {
        expect(endForNewStart("2026-07-29T10:00", "2026-07-29T11:00", "2026-07-29T23:30")).toBe(
            "2026-07-30T00:30"
        );
    });

    it("falls back to an hour when the form has no usable duration yet", () => {
        expect(endForNewStart("", "", "2026-07-29T21:00")).toBe("2026-07-29T22:00");
    });

    it("falls back to an hour when the existing end precedes the start", () => {
        expect(endForNewStart("2026-07-29T21:00", "2026-07-29T20:00", "2026-07-29T15:00")).toBe(
            "2026-07-29T16:00"
        );
    });

    it("does nothing while the new start is still being typed", () => {
        // Otherwise the end jumps to 1970 or blanks out mid-keystroke.
        expect(endForNewStart("2026-07-29T09:00", "2026-07-29T10:00", "")).toBeNull();
        expect(endForNewStart("2026-07-29T09:00", "2026-07-29T10:00", "2026-07")).toBeNull();
    });
});

describe("startForNewEnd", () => {
    it("backs the start up when the end is set before it", () => {
        // The reported case: 9pm–10pm, end retyped to 8pm → 7pm–8pm.
        expect(startForNewEnd("2026-07-29T21:00", "2026-07-29T22:00", "2026-07-29T20:00")).toBe(
            "2026-07-29T19:00"
        );
    });

    it("leaves the start alone when the end still follows it", () => {
        // Stretching an event is a legitimate edit, not a mistake.
        expect(
            startForNewEnd("2026-07-29T09:00", "2026-07-29T10:00", "2026-07-29T17:00")
        ).toBeNull();
    });

    it("shifts on a zero-length event too", () => {
        expect(startForNewEnd("2026-07-29T09:00", "2026-07-29T10:00", "2026-07-29T09:00")).toBe(
            "2026-07-29T08:00"
        );
    });

    it("preserves a non-hour duration when backing up", () => {
        expect(startForNewEnd("2026-07-29T09:00", "2026-07-29T11:30", "2026-07-29T08:00")).toBe(
            "2026-07-29T05:30"
        );
    });

    it("rolls back across midnight", () => {
        expect(startForNewEnd("2026-07-29T10:00", "2026-07-29T11:00", "2026-07-29T00:30")).toBe(
            "2026-07-28T23:30"
        );
    });

    it("does nothing while the new end is still being typed", () => {
        expect(startForNewEnd("2026-07-29T09:00", "2026-07-29T10:00", "")).toBeNull();
        expect(startForNewEnd("2026-07-29T09:00", "2026-07-29T10:00", "2026-07-2")).toBeNull();
    });

    it("does nothing when there is no start to compare against", () => {
        expect(startForNewEnd("", "", "2026-07-29T20:00")).toBeNull();
    });
});

describe("local input parsing", () => {
    it("round-trips a value without shifting it by the UTC offset", () => {
        // The trap this avoids: `new Date("2026-07-29T21:00")` handling
        // varies, and a date-only string parses as UTC midnight — either
        // one moves the user's wall-clock time.
        const value = "2026-07-29T21:00";
        expect(formatLocalInput(parseLocalInput(value) as Date)).toBe(value);
    });

    it("reads the value as local wall-clock time", () => {
        const parsed = parseLocalInput("2026-07-29T21:00") as Date;
        expect(parsed.getHours()).toBe(21);
        expect(parsed.getDate()).toBe(29);
    });

    it("rejects incomplete and non-values", () => {
        expect(parseLocalInput("")).toBeNull();
        expect(parseLocalInput("2026-07-29")).toBeNull();
        expect(parseLocalInput("not a date")).toBeNull();
    });
});
