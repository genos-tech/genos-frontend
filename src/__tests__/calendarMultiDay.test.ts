/**
 * Multi-day events as continuous bars, and the free/busy title.
 *
 * The layout rules that produce silent, plausible-looking bugs:
 *
 *  - Google's all-day `end.date` is EXCLUSIVE. Off by one here makes
 *    every all-day event look a day longer than it is.
 *  - A lane is only reusable when the previous bar ends STRICTLY before
 *    the next begins. Two events where one ends the day the next starts
 *    still share that day — the classic greedy-packing off-by-one.
 *  - Timed events must NOT become spans. `TimelineView` renders them on
 *    their start day only, so a 10pm–2am meeting turning into a two-day
 *    bar in Month view would contradict Week view.
 */

import dayjs from "dayjs";
import { describe, expect, it } from "vitest";

import {
    eventLabel,
    isFreeBusyEvent,
    UNTITLED_LABEL,
} from "../features/calendar/utils/eventLabel";
import {
    clampLanes,
    coversDay,
    eventDayRange,
    isMultiDaySpan,
    laneCount,
    layoutSpanSegments,
} from "../features/calendar/utils/multiDay";
import { CalendarEvent, sourceKey } from "../features/integrations/services/calendar";

/** All-day event. `end` is the EXCLUSIVE date, exactly as Google sends. */
const allDay = (id: string, start: string, endExclusive: string): CalendarEvent => ({
    id,
    summary: id,
    start: { date: start },
    end: { date: endExclusive },
});

const timed = (id: string, start: string, end: string): CalendarEvent => ({
    id,
    summary: id,
    start: { dateTime: start },
    end: { dateTime: end },
});

/** The week of Mon 2026-07-06 … Sun 2026-07-12. */
const week = (startISO = "2026-07-06") =>
    Array.from({ length: 7 }, (_, i) => dayjs(startISO).add(i, "day"));

describe("eventDayRange", () => {
    it("treats Google's all-day end date as exclusive", () => {
        // 6th → 8th exclusive means the user sees it on the 6th and 7th.
        const range = eventDayRange(allDay("trip", "2026-07-06", "2026-07-08"))!;
        expect(range.start.format("YYYY-MM-DD")).toBe("2026-07-06");
        expect(range.end.format("YYYY-MM-DD")).toBe("2026-07-07");
    });

    it("collapses a single-day all-day event to one day", () => {
        const range = eventDayRange(allDay("solo", "2026-07-06", "2026-07-07"))!;
        expect(range.start.isSame(range.end, "day")).toBe(true);
    });

    it("survives an end before the start", () => {
        const range = eventDayRange(allDay("broken", "2026-07-06", "2026-07-01"))!;
        expect(range.end.isBefore(range.start)).toBe(false);
    });

    it("returns null when there's no usable start", () => {
        expect(eventDayRange({ id: "x" })).toBeNull();
    });
});

describe("isMultiDaySpan", () => {
    it("is true for an all-day event covering two or more days", () => {
        expect(isMultiDaySpan(allDay("trip", "2026-07-06", "2026-07-09"))).toBe(true);
    });

    it("is false for a single-day all-day event", () => {
        expect(isMultiDaySpan(allDay("solo", "2026-07-06", "2026-07-07"))).toBe(false);
    });

    it("is false for a timed event that crosses midnight", () => {
        // The rule is all-day, not "crosses midnight" — otherwise an
        // ordinary late meeting becomes a two-day bar in Month view
        // while staying one block in Week view.
        expect(isMultiDaySpan(timed("late", "2026-07-06T22:00:00Z", "2026-07-07T02:00:00Z"))).toBe(
            false
        );
    });

    it("is false for a multi-day TIMED event", () => {
        expect(isMultiDaySpan(timed("conf", "2026-07-06T09:00:00Z", "2026-07-09T17:00:00Z"))).toBe(
            false
        );
    });
});

describe("layoutSpanSegments", () => {
    it("returns nothing when no event spans days", () => {
        const segments = layoutSpanSegments(
            [
                allDay("solo", "2026-07-06", "2026-07-07"),
                timed("m", "2026-07-06T09:00:00Z", "2026-07-06T10:00:00Z"),
            ],
            week()
        );
        expect(segments).toEqual([]);
    });

    it("clips a span that lies fully inside the row", () => {
        const [seg] = layoutSpanSegments([allDay("a", "2026-07-07", "2026-07-10")], week());
        expect(seg.startIndex).toBe(1); // Tue
        expect(seg.endIndex).toBe(3); // Thu (9th inclusive)
        expect(seg.continuesBefore).toBe(false);
        expect(seg.continuesAfter).toBe(false);
    });

    it("clips and flags a span crossing the row start", () => {
        const [seg] = layoutSpanSegments([allDay("a", "2026-07-03", "2026-07-09")], week());
        expect(seg.startIndex).toBe(0);
        expect(seg.continuesBefore).toBe(true);
        expect(seg.continuesAfter).toBe(false);
    });

    it("clips and flags a span crossing the row end", () => {
        const [seg] = layoutSpanSegments([allDay("a", "2026-07-10", "2026-07-20")], week());
        expect(seg.endIndex).toBe(6);
        expect(seg.continuesBefore).toBe(false);
        expect(seg.continuesAfter).toBe(true);
    });

    it("spans the full row and flags both ends when it engulfs the week", () => {
        const [seg] = layoutSpanSegments([allDay("a", "2026-06-01", "2026-08-01")], week());
        expect(seg.startIndex).toBe(0);
        expect(seg.endIndex).toBe(6);
        expect(seg.continuesBefore).toBe(true);
        expect(seg.continuesAfter).toBe(true);
    });

    it("excludes spans that don't touch the row", () => {
        expect(layoutSpanSegments([allDay("a", "2026-05-01", "2026-05-10")], week())).toEqual([]);
    });

    it("puts overlapping spans in separate lanes", () => {
        const segments = layoutSpanSegments(
            [allDay("a", "2026-07-06", "2026-07-09"), allDay("b", "2026-07-07", "2026-07-10")],
            week()
        );
        expect(new Set(segments.map((s) => s.lane)).size).toBe(2);
    });

    it("reuses a lane for spans that don't overlap", () => {
        const segments = layoutSpanSegments(
            [allDay("a", "2026-07-06", "2026-07-08"), allDay("b", "2026-07-09", "2026-07-11")],
            week()
        );
        // a covers 6–7, b covers 9–10: a clear day between them.
        expect(segments.every((s) => s.lane === 0)).toBe(true);
    });

    it("does NOT share a lane when one ends the day the next begins", () => {
        // a covers 6th–8th, b starts on the 8th — they share the 8th, so
        // stacking them in one lane would overlap by a column. This is
        // the off-by-one greedy packing gets wrong.
        const segments = layoutSpanSegments(
            [allDay("a", "2026-07-06", "2026-07-09"), allDay("b", "2026-07-08", "2026-07-11")],
            week()
        );
        const laneOf = (id: string) => segments.find((s) => s.event.id === id)!.lane;
        expect(laneOf("a")).not.toBe(laneOf("b"));
    });

    it("is stable across repeated calls", () => {
        const events = [
            allDay("b", "2026-07-06", "2026-07-09"),
            allDay("a", "2026-07-06", "2026-07-09"),
        ];
        const first = layoutSpanSegments(events, week()).map((s) => `${s.event.id}:${s.lane}`);
        const second = layoutSpanSegments(events, week()).map((s) => `${s.event.id}:${s.lane}`);
        expect(first).toEqual(second);
    });

    it("handles an empty day row", () => {
        expect(layoutSpanSegments([allDay("a", "2026-07-06", "2026-07-09")], [])).toEqual([]);
    });
});

describe("clampLanes", () => {
    const manyOverlapping = [
        allDay("a", "2026-07-06", "2026-07-10"),
        allDay("b", "2026-07-06", "2026-07-10"),
        allDay("c", "2026-07-06", "2026-07-10"),
    ];

    it("keeps only the segments within the lane budget", () => {
        const segments = layoutSpanSegments(manyOverlapping, week());
        expect(laneCount(segments)).toBe(3);

        const { visible } = clampLanes(segments, 2, 7);
        expect(visible).toHaveLength(2);
    });

    it("counts hidden spans per column so the cell can surface them", () => {
        // Dropping them silently would make an event vanish with no
        // affordance to reach it.
        const segments = layoutSpanSegments(manyOverlapping, week());
        const { hiddenPerColumn } = clampLanes(segments, 2, 7);
        // a/b/c all cover the 6th–9th → columns 0..3.
        expect(hiddenPerColumn.slice(0, 4)).toEqual([1, 1, 1, 1]);
        expect(hiddenPerColumn.slice(4)).toEqual([0, 0, 0]);
    });

    it("hides nothing when everything fits", () => {
        const segments = layoutSpanSegments([allDay("a", "2026-07-06", "2026-07-09")], week());
        const { visible, hiddenPerColumn } = clampLanes(segments, 2, 7);
        expect(visible).toHaveLength(1);
        expect(hiddenPerColumn.every((n) => n === 0)).toBe(true);
    });
});

describe("coversDay", () => {
    // The +N popover is "everything on this day" and must still list
    // multi-day events even though they no longer render as chips.
    const trip = allDay("trip", "2026-07-06", "2026-07-09");

    it("includes every day the event covers", () => {
        for (const d of ["2026-07-06", "2026-07-07", "2026-07-08"]) {
            expect(coversDay(trip, dayjs(d))).toBe(true);
        }
    });

    it("excludes the exclusive end date", () => {
        expect(coversDay(trip, dayjs("2026-07-09"))).toBe(false);
    });

    it("excludes days before the start", () => {
        expect(coversDay(trip, dayjs("2026-07-05"))).toBe(false);
    });
});

describe("eventLabel", () => {
    const ACCOUNT = "acc-1";
    const SHARED = sourceKey(ACCOUNT, "teammate@example.com");
    const freeBusy = new Set([SHARED]);

    const withSource = (summary: string | undefined, calendarId: string): CalendarEvent => ({
        id: "e1",
        summary,
        _source: { account_id: ACCOUNT, account_email: "me@work.com", calendar_id: calendarId },
    });

    it("uses the summary when there is one", () => {
        expect(eventLabel(withSource("Standup", "primary"), freeBusy, "Busy")).toBe("Standup");
    });

    it("shows Busy for a title-less event on a free/busy calendar", () => {
        // Google strips the title at this share level, so nothing is
        // missing — "(no title)" would read as a Genos bug.
        expect(eventLabel(withSource(undefined, "teammate@example.com"), freeBusy, "Busy")).toBe(
            "Busy"
        );
    });

    it("shows (no title) for a title-less event on a readable calendar", () => {
        expect(eventLabel(withSource(undefined, "primary"), freeBusy, "Busy")).toBe(
            UNTITLED_LABEL
        );
    });

    it("prefers a real title even on a free/busy calendar", () => {
        expect(eventLabel(withSource("Offsite", "teammate@example.com"), freeBusy, "Busy")).toBe(
            "Offsite"
        );
    });

    it("treats a whitespace-only summary as absent", () => {
        expect(eventLabel(withSource("   ", "teammate@example.com"), freeBusy, "Busy")).toBe(
            "Busy"
        );
    });

    it("falls back to (no title) for an event with no source", () => {
        expect(eventLabel({ id: "x" }, freeBusy, "Busy")).toBe(UNTITLED_LABEL);
    });

    it("isFreeBusyEvent is false when the source isn't in the set", () => {
        expect(isFreeBusyEvent(withSource(undefined, "primary"), freeBusy)).toBe(false);
    });
});
