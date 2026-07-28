/**
 * The RRULE that makes an event repeat.
 *
 * Table-tested because every rule here is an off-by-one or a 400 waiting
 * to happen, and each fails in a way that looks plausible in the UI:
 *
 *  - UNTIL is INCLUSIVE, unlike Google's all-day `end.date` which is
 *    exclusive. Reusing the existing `inclusiveToGoogleEnd` helper (the
 *    obvious move, it sits right next door) gives one occurrence too
 *    many — and "one extra meeting" is not something anyone notices
 *    until it fires.
 *  - UNTIL's form must match the start's: date-only for all-day, a UTC
 *    instant with `Z` for timed. Mismatched is a Google 400.
 *  - COUNT and UNTIL are mutually exclusive.
 */

import { describe, expect, it } from "vitest";

import {
    buildRecurrence,
    DEFAULT_RECURRENCE,
    isRepeating,
    parseRecurrence,
    seriesMasterId,
    type RecurrenceSpec,
} from "../features/calendar/utils/rrule";

const spec = (over: Partial<RecurrenceSpec> = {}): RecurrenceSpec => ({
    ...DEFAULT_RECURRENCE,
    ...over,
});

/** The single RRULE line, minus its prefix. */
const ruleOf = (lines: string[]): string => lines[0].replace("RRULE:", "");

describe("buildRecurrence", () => {
    it("produces nothing for a non-repeating event", () => {
        // Also exactly what the API needs to END an existing series, so
        // callers don't special-case the two.
        expect(buildRecurrence(spec({ frequency: "none" }), { allDay: false })).toEqual([]);
    });

    it("builds a simple daily rule", () => {
        expect(buildRecurrence(spec({ frequency: "daily" }), { allDay: false })).toEqual([
            "RRULE:FREQ=DAILY",
        ]);
    });

    it("omits INTERVAL when it is 1", () => {
        // It's the default, and users see this string in Google's own UI.
        expect(ruleOf(buildRecurrence(spec({ frequency: "weekly" }), { allDay: false }))).toBe(
            "FREQ=WEEKLY"
        );
    });

    it("includes INTERVAL above 1", () => {
        expect(
            ruleOf(buildRecurrence(spec({ frequency: "weekly", interval: 3 }), { allDay: false }))
        ).toBe("FREQ=WEEKLY;INTERVAL=3");
    });

    it("emits BYDAY for weekly, sorted and deduplicated", () => {
        const rule = ruleOf(
            buildRecurrence(spec({ frequency: "weekly", byWeekday: [3, 1, 1] }), {
                allDay: false,
            })
        );
        expect(rule).toBe("FREQ=WEEKLY;BYDAY=MO,WE");
    });

    it("ignores BYDAY for non-weekly frequencies", () => {
        // BYDAY on a MONTHLY rule means something entirely different
        // ("every Monday of the month"), so carrying the weekly picker's
        // state over would silently change the meaning.
        const rule = ruleOf(
            buildRecurrence(spec({ frequency: "monthly", byWeekday: [1, 3] }), { allDay: false })
        );
        expect(rule).toBe("FREQ=MONTHLY");
    });

    it("uses COUNT for an after-N ending", () => {
        const rule = ruleOf(
            buildRecurrence(spec({ frequency: "daily", end: { kind: "afterCount", count: 10 } }), {
                allDay: false,
            })
        );
        expect(rule).toBe("FREQ=DAILY;COUNT=10");
    });

    it("never emits COUNT and UNTIL together", () => {
        // They're mutually exclusive; sending both is invalid.
        const rule = ruleOf(
            buildRecurrence(spec({ frequency: "daily", end: { kind: "afterCount", count: 5 } }), {
                allDay: false,
            })
        );
        expect(rule).toContain("COUNT=");
        expect(rule).not.toContain("UNTIL=");
    });

    it("uses the date-only UNTIL form for an all-day event", () => {
        const rule = ruleOf(
            buildRecurrence(
                spec({ frequency: "weekly", end: { kind: "onDate", date: "2026-12-31" } }),
                { allDay: true }
            )
        );
        expect(rule).toBe("FREQ=WEEKLY;UNTIL=20261231");
    });

    it("does NOT shift UNTIL by a day for all-day events", () => {
        // The trap: `end.date` is exclusive and gets +1 elsewhere in this
        // codebase, but UNTIL is inclusive. Applying the same shift here
        // schedules one occurrence past what the user asked for.
        const rule = ruleOf(
            buildRecurrence(
                spec({ frequency: "daily", end: { kind: "onDate", date: "2026-12-31" } }),
                { allDay: true }
            )
        );
        expect(rule).toContain("UNTIL=20261231");
        expect(rule).not.toContain("UNTIL=20270101");
    });

    it("uses a UTC instant for a timed event's UNTIL", () => {
        const rule = ruleOf(
            buildRecurrence(
                spec({ frequency: "daily", end: { kind: "onDate", date: "2026-12-31" } }),
                { allDay: false }
            )
        );
        // Form, not exact value — the instant depends on the runner's
        // timezone. What must hold is the UTC datetime shape.
        expect(rule).toMatch(/UNTIL=\d{8}T\d{6}Z$/);
    });

    it("anchors a timed UNTIL at the END of the chosen day", () => {
        // Anchoring at midnight would exclude every occurrence later on
        // the user's final day — silently dropping the last one.
        const rule = ruleOf(
            buildRecurrence(
                spec({ frequency: "daily", end: { kind: "onDate", date: "2026-06-15" } }),
                { allDay: false }
            )
        );
        const until = rule.match(/UNTIL=(\d{8}T\d{6})Z/)![1];
        const asDate = new Date(
            `${until.slice(0, 4)}-${until.slice(4, 6)}-${until.slice(6, 8)}T${until.slice(
                9,
                11
            )}:${until.slice(11, 13)}:${until.slice(13, 15)}Z`
        );
        // Must be at or after the local end of that day.
        expect(asDate.getTime()).toBeGreaterThanOrEqual(new Date("2026-06-15T23:59:59").getTime());
    });

    it("skips a zero or negative count", () => {
        const rule = ruleOf(
            buildRecurrence(spec({ frequency: "daily", end: { kind: "afterCount", count: 0 } }), {
                allDay: false,
            })
        );
        expect(rule).toBe("FREQ=DAILY");
    });

    it("skips an empty end date", () => {
        const rule = ruleOf(
            buildRecurrence(spec({ frequency: "daily", end: { kind: "onDate", date: "" } }), {
                allDay: false,
            })
        );
        expect(rule).toBe("FREQ=DAILY");
    });
});

describe("parseRecurrence", () => {
    it("round-trips a weekly rule with days and a count", () => {
        const original = spec({
            frequency: "weekly",
            interval: 2,
            byWeekday: [1, 4],
            end: { kind: "afterCount", count: 8 },
        });
        expect(parseRecurrence(buildRecurrence(original, { allDay: false }))).toEqual(original);
    });

    it("round-trips an all-day UNTIL rule", () => {
        const original = spec({
            frequency: "daily",
            interval: 1,
            end: { kind: "onDate", date: "2026-12-31" },
        });
        expect(parseRecurrence(buildRecurrence(original, { allDay: true }))).toEqual(original);
    });

    it("reads the date out of a timed UNTIL", () => {
        const parsed = parseRecurrence(["RRULE:FREQ=DAILY;UNTIL=20261231T145959Z"]);
        expect(parsed.end).toEqual({ kind: "onDate", date: "2026-12-31" });
    });

    it("falls back to no-repeat for an empty or missing array", () => {
        expect(parseRecurrence(undefined)).toEqual(DEFAULT_RECURRENCE);
        expect(parseRecurrence([])).toEqual(DEFAULT_RECURRENCE);
    });

    it("falls back for a rule the picker can't represent", () => {
        // A rule we can't show shouldn't stop the modal opening.
        expect(parseRecurrence(["RRULE:FREQ=HOURLY"])).toEqual(DEFAULT_RECURRENCE);
    });

    it("ignores non-RRULE lines", () => {
        const parsed = parseRecurrence([
            "EXDATE;VALUE=DATE:20260810",
            "RRULE:FREQ=MONTHLY;INTERVAL=2",
        ]);
        expect(parsed.frequency).toBe("monthly");
        expect(parsed.interval).toBe(2);
    });

    it("defaults a malformed interval to 1", () => {
        expect(parseRecurrence(["RRULE:FREQ=DAILY;INTERVAL=abc"]).interval).toBe(1);
    });

    it("drops unrecognised weekday codes", () => {
        expect(parseRecurrence(["RRULE:FREQ=WEEKLY;BYDAY=MO,XX,FR"]).byWeekday).toEqual([1, 5]);
    });
});

describe("isRepeating", () => {
    it("is false only for none", () => {
        expect(isRepeating(spec({ frequency: "none" }))).toBe(false);
        expect(isRepeating(spec({ frequency: "daily" }))).toBe(true);
    });
});

describe("seriesMasterId", () => {
    it("returns the master id for an instance", () => {
        // `singleEvents=true` means we only ever receive instances; the
        // master is what a series-wide edit must target.
        expect(seriesMasterId({ id: "inst_2026", recurringEventId: "master" })).toBe("master");
    });

    it("returns null for a standalone event", () => {
        expect(seriesMasterId({ id: "one-off" })).toBeNull();
    });
});
