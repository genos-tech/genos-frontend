/**
 * Laying out events that cover several days as one continuous bar.
 *
 * A three-day trip used to render as three separate chips, one per day
 * cell, with nothing tying them together — it read as three unrelated
 * events. Instead, such an event becomes a single bar spanning its
 * columns, clipped to whatever row is being drawn, with arrows marking
 * where it continues past the edge.
 *
 * Which events qualify — deliberately ALL-DAY ONLY:
 *
 *   `TimelineView` already renders timed events on their start day
 *   alone. If "crosses midnight" made something a span, an ordinary
 *   10pm–2am meeting would stretch into a two-day bar in Month view
 *   while staying a single block in Week view. All-day events are the
 *   ones users actually mean by "several days" (trips, leave,
 *   conferences), so the rule is: all-day AND covering 2+ days. Timed
 *   events stay a chip on their start day, matching the timeline.
 */

import dayjs, { Dayjs } from "dayjs";

import { CalendarEvent } from "../../integrations/services/calendar";

/** Parse to a Dayjs, or null when the value isn't a usable date. Google
 *  fields are typed as optional strings, so every parse here is
 *  defensive rather than assumed-valid. */
const parseDay = (value: string): Dayjs | null => {
    const d = dayjs(value);
    return d.isValid() ? d : null;
};

/** Inclusive day range, both ends normalised to start-of-day. */
export interface DayRange {
    start: Dayjs;
    end: Dayjs;
}

export const isAllDayEvent = (e: CalendarEvent): boolean => !!e.start?.date && !e.start?.dateTime;

/**
 * The inclusive span of days an event covers.
 *
 * Google's all-day `end.date` is EXCLUSIVE — a single-day event on the
 * 5th arrives as start 5th / end 6th — so the end is pulled back a day
 * to get the last day the user actually sees it on. Getting this wrong
 * makes every all-day event look one day too long.
 */
export const eventDayRange = (e: CalendarEvent): DayRange | null => {
    const rawStart = e.start?.date || e.start?.dateTime;
    if (!rawStart) return null;
    const start = parseDay(rawStart);
    if (!start) return null;

    let end = start;
    if (e.end?.date) {
        const exclusive = parseDay(e.end.date);
        if (exclusive) end = exclusive.subtract(1, "day");
    } else if (e.end?.dateTime) {
        const parsed = parseDay(e.end.dateTime);
        if (parsed) end = parsed;
    }
    const startDay = start.startOf("day");
    const endDay = end.startOf("day");
    // A malformed event with end before start would produce a negative
    // width bar; collapse it to a single day instead.
    return { start: startDay, end: endDay.isBefore(startDay) ? startDay : endDay };
};

/** True when the event should render as a continuous bar rather than a
 *  per-day chip: all-day, and covering at least two calendar days. */
export const isMultiDaySpan = (e: CalendarEvent): boolean => {
    if (!isAllDayEvent(e)) return false;
    const range = eventDayRange(e);
    if (!range) return false;
    return range.end.diff(range.start, "day") >= 1;
};

/** One event's presence within a single row of days. */
export interface SpanSegment {
    event: CalendarEvent;
    /** Column index within the row's `days`, inclusive. */
    startIndex: number;
    /** Column index within the row's `days`, inclusive. */
    endIndex: number;
    /** Event began before this row — draw a left continuation arrow and
     *  square off the leading edge. */
    continuesBefore: boolean;
    /** Event continues past this row. */
    continuesAfter: boolean;
    /** Stacking row, 0-based. Assigned so overlapping spans never
     *  collide. */
    lane: number;
}

/**
 * Place every multi-day event into lanes for one row of days.
 *
 * `days` is the row being rendered — a week in Month view, or the
 * visible columns in Week / 3-day view. Events are clipped to the row,
 * so the same event yields one segment per row it crosses.
 *
 * Lane assignment is greedy first-fit over events sorted by start, then
 * by length descending: longer bars settle into the top lanes, which
 * keeps a long trip visually continuous across weeks instead of hopping
 * between lanes row to row.
 */
export const layoutSpanSegments = (events: CalendarEvent[], days: Dayjs[]): SpanSegment[] => {
    if (days.length === 0) return [];
    const rowStart = days[0].startOf("day");
    const rowEnd = days[days.length - 1].startOf("day");

    const candidates: Array<{ event: CalendarEvent; range: DayRange }> = [];
    for (const event of events) {
        if (!isMultiDaySpan(event)) continue;
        const range = eventDayRange(event);
        if (!range) continue;
        // Skip events that don't touch this row at all.
        if (range.end.isBefore(rowStart) || range.start.isAfter(rowEnd)) continue;
        candidates.push({ event, range });
    }

    candidates.sort((a, b) => {
        const startDiff = a.range.start.valueOf() - b.range.start.valueOf();
        if (startDiff !== 0) return startDiff;
        const aLen = a.range.end.diff(a.range.start, "day");
        const bLen = b.range.end.diff(b.range.start, "day");
        if (aLen !== bLen) return bLen - aLen;
        // Final tiebreak on id so the layout is stable across renders —
        // otherwise two same-shaped events could swap lanes on a
        // re-render and the bars would visibly jump.
        return String(a.event.id).localeCompare(String(b.event.id));
    });

    // `laneEnds[i]` is the last column index lane `i` is occupied
    // through. A lane is free for a segment starting at `s` only when it
    // ends STRICTLY before `s`: an event ending on the same day the next
    // one begins still shares that day, so `<=` here would overlap them
    // by exactly one column.
    const laneEnds: number[] = [];
    const out: SpanSegment[] = [];

    for (const { event, range } of candidates) {
        const continuesBefore = range.start.isBefore(rowStart);
        const continuesAfter = range.end.isAfter(rowEnd);
        const startIndex = continuesBefore ? 0 : range.start.diff(rowStart, "day");
        const endIndex = continuesAfter ? days.length - 1 : range.end.diff(rowStart, "day");

        let lane = laneEnds.findIndex((end) => end < startIndex);
        if (lane === -1) {
            lane = laneEnds.length;
            laneEnds.push(endIndex);
        } else {
            laneEnds[lane] = endIndex;
        }

        out.push({ event, startIndex, endIndex, continuesBefore, continuesAfter, lane });
    }

    return out;
};

/** How many lanes a set of segments needs. */
export const laneCount = (segments: SpanSegment[]): number =>
    segments.reduce((max, s) => Math.max(max, s.lane + 1), 0);

/** Segments that fit within `maxLanes`, and a per-column count of those
 *  that don't, so a cell can fold the remainder into its "+N more"
 *  affordance rather than dropping them silently. */
export const clampLanes = (
    segments: SpanSegment[],
    maxLanes: number,
    columnCount: number
): { visible: SpanSegment[]; hiddenPerColumn: number[] } => {
    const visible: SpanSegment[] = [];
    const hiddenPerColumn = new Array<number>(columnCount).fill(0);
    for (const segment of segments) {
        if (segment.lane < maxLanes) {
            visible.push(segment);
            continue;
        }
        for (let i = segment.startIndex; i <= segment.endIndex && i < columnCount; i++) {
            hiddenPerColumn[i] += 1;
        }
    }
    return { visible, hiddenPerColumn };
};

/** True if the event covers `day` — used to build the "everything on
 *  this day" list behind the +N popover, which must still include
 *  multi-day events even though they no longer render as chips. */
export const coversDay = (e: CalendarEvent, day: Dayjs): boolean => {
    const range = eventDayRange(e);
    if (!range) return false;
    const target = day.startOf("day");
    return !target.isBefore(range.start) && !target.isAfter(range.end);
};
