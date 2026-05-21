import { Dayjs } from "dayjs";

import { CalendarEvent } from "../../integrations/services/calendar";

/** Visible hour band. Anything outside [START, END) clamps at the
 *  boundary and renders a chevron so the user knows content was
 *  clipped. 6 AM – 11 PM is the macOS/Google default that fits
 *  most workdays without scrolling.
 *
 *  END is exclusive, so the band has (END - START) full rows. */
export const TIMELINE_START_HOUR = 6;
export const TIMELINE_END_HOUR = 23;
export const TIMELINE_HOURS = TIMELINE_END_HOUR - TIMELINE_START_HOUR;
/** Visual height of one hour row, in pixels. Multiplied by
 *  `TIMELINE_HOURS` to set the grid height; events use it to
 *  compute top/height. */
export const HOUR_BAND_PX = 48;
export const TIMELINE_TOTAL_PX = TIMELINE_HOURS * HOUR_BAND_PX;

/** Returns true when the event has explicit start/end dateTime
 *  fields (i.e., is a TIMED event). All-day events are bucketed
 *  separately and rendered in the header strip. */
export const isTimedEvent = (e: CalendarEvent): boolean =>
    Boolean(e.start?.dateTime && e.end?.dateTime);

/** Y-offset (in px) of an event's top edge inside a day column.
 *  Events that start before the visible band clamp to 0. */
export const eventTopPx = (start: Dayjs, columnDay: Dayjs): number => {
    const dayStart = columnDay.startOf("day").add(TIMELINE_START_HOUR, "hour");
    const minutesFromStart = start.diff(dayStart, "minute");
    const px = (minutesFromStart / 60) * HOUR_BAND_PX;
    return Math.max(0, px);
};

/** Visual height (in px) of an event inside its day column. End
 *  beyond the visible band clamps to the bottom; start before the
 *  band reduces height accordingly so the rendered block
 *  represents the *visible* portion of the duration. */
export const eventHeightPx = (start: Dayjs, end: Dayjs, columnDay: Dayjs): number => {
    const bandStart = columnDay.startOf("day").add(TIMELINE_START_HOUR, "hour");
    const bandEnd = columnDay.startOf("day").add(TIMELINE_END_HOUR, "hour");
    const effectiveStart = start.isBefore(bandStart) ? bandStart : start;
    const effectiveEnd = end.isAfter(bandEnd) ? bandEnd : end;
    if (!effectiveEnd.isAfter(effectiveStart)) return 0;
    const minutes = effectiveEnd.diff(effectiveStart, "minute");
    // Floor of 1 row of minutes (=22px) so a "0-duration" event
    // (sometimes produced by Google for spec quirks) still gets
    // a visible block.
    return Math.max(22, (minutes / 60) * HOUR_BAND_PX);
};

/** Sweep-line assignment of overlap "columns" for events that
 *  collide on the timeline. Two overlapping events end up in
 *  separate columns; three become three columns at 33% width
 *  each, etc. Within a non-overlapping run, columnCount resets
 *  so the next group of overlaps doesn't inherit a wide layout.
 *
 *  Returns one entry per input event, in the same order. The
 *  caller computes pixel/percent positions from `column` and
 *  `columnCount`. */
export interface OverlapSlot {
    /** Zero-indexed lane assignment within the overlap cluster. */
    column: number;
    /** Total lanes the event's cluster is split into. */
    columnCount: number;
}

interface SlotEvent {
    start: Dayjs;
    end: Dayjs;
}

export const resolveOverlapColumns = <T extends SlotEvent>(events: T[]): OverlapSlot[] => {
    // Sort indices by start so we can sweep in time order while
    // preserving the original event order in the result.
    const indices = events
        .map((e, i) => ({ i, start: e.start, end: e.end }))
        .sort((a, b) => a.start.valueOf() - b.start.valueOf());

    const slots: OverlapSlot[] = events.map(() => ({ column: 0, columnCount: 1 }));
    // Active lanes — each entry is the END time of the event
    // currently occupying that lane, or null when free.
    const lanes: (Dayjs | null)[] = [];
    // Group of indices that overlap each other; whenever the
    // active set empties we flush by writing columnCount = group
    // size to every member.
    let group: number[] = [];
    let groupMaxLanes = 0;

    const flushGroup = () => {
        for (const idx of group) {
            slots[idx].columnCount = groupMaxLanes;
        }
        group = [];
        groupMaxLanes = 0;
    };

    for (const { i, start, end } of indices) {
        // Free any lane whose event has ended (end <= start of
        // this one). When all lanes are free, the previous group
        // has finished and can be flushed.
        for (let l = 0; l < lanes.length; l++) {
            if (lanes[l] && !lanes[l]!.isAfter(start)) {
                lanes[l] = null;
            }
        }
        const allFree = lanes.every((l) => l === null);
        if (allFree && group.length > 0) {
            flushGroup();
            // Reset lanes — fresh cluster starts here.
            lanes.length = 0;
        }
        // Assign the first free lane, or push a new one.
        let assigned = -1;
        for (let l = 0; l < lanes.length; l++) {
            if (lanes[l] === null) {
                lanes[l] = end;
                assigned = l;
                break;
            }
        }
        if (assigned === -1) {
            lanes.push(end);
            assigned = lanes.length - 1;
        }
        slots[i] = { column: assigned, columnCount: 1 };
        group.push(i);
        groupMaxLanes = Math.max(groupMaxLanes, lanes.length);
    }
    flushGroup();
    return slots;
};

/** Returns minute-rounded "now" updated at most once per minute
 *  via the caller's effect — exposed as a helper so the formula
 *  for converting "now" → px stays next to the eventTopPx logic
 *  and they evolve together. */
export const nowOffsetPx = (now: Dayjs, columnDay: Dayjs): number | null => {
    if (!now.isSame(columnDay, "day")) return null;
    const hour = now.hour() + now.minute() / 60;
    if (hour < TIMELINE_START_HOUR || hour >= TIMELINE_END_HOUR) return null;
    return (hour - TIMELINE_START_HOUR) * HOUR_BAND_PX;
};
