import dayjs, { Dayjs } from "dayjs";

/**
 * Build a deterministic 6×7 day matrix for a monthly calendar grid.
 *
 * Always returns 6 rows so the visible area never reflows when the
 * month length changes (28-day Februarys can otherwise produce a
 * 4-row month vs. a 6-row neighbor and the layout snaps). Each row
 * is exactly 7 days. Days outside the focused month are still real
 * `Dayjs` instances — callers dim them visually but use them to
 * fetch / render events that span the boundary.
 *
 * `weekStart` follows the JS/`dayjs` convention: 0 = Sunday,
 * 1 = Monday. Default Sunday matches the US convention and the
 * existing Google Calendar tab.
 */
export const buildMonthGrid = (focused: Dayjs, weekStart: 0 | 1 = 0): Dayjs[][] => {
    // First day shown is the start-of-week containing the 1st.
    const firstOfMonth = focused.startOf("month");
    const dayOfWeek = firstOfMonth.day(); // 0..6, Sunday=0
    const offset = (dayOfWeek - weekStart + 7) % 7;
    const gridStart = firstOfMonth.subtract(offset, "day");

    const rows: Dayjs[][] = [];
    let cursor = gridStart;
    for (let r = 0; r < 6; r++) {
        const row: Dayjs[] = [];
        for (let c = 0; c < 7; c++) {
            row.push(cursor);
            cursor = cursor.add(1, "day");
        }
        rows.push(row);
    }
    return rows;
};

/**
 * Inclusive range covering the whole 6×7 grid for the focused month.
 * Used to query Google Calendar for everything visible in one shot.
 */
export const monthVisibleRange = (
    focused: Dayjs,
    weekStart: 0 | 1 = 0
): { start: Dayjs; end: Dayjs } => {
    const grid = buildMonthGrid(focused, weekStart);
    const start = grid[0][0].startOf("day");
    const end = grid[grid.length - 1][6].endOf("day");
    return { start, end };
};

/** The four view modes the Calendar modal supports. `"day"` shows
 *  a single column, `"3day"` three, `"week"` seven (week-aligned),
 *  `"month"` the 6×7 grid. */
export type CalendarView = "month" | "week" | "3day" | "day";

/** Visible window for one of the view modes, in the same shape
 *  `listEvents` accepts. For Week, the start is snapped to the
 *  week boundary; for Day / 3-day, it starts on the anchor itself
 *  so navigating forward by 1 day yields a deterministic shift. */
export const visibleRange = (
    view: CalendarView,
    anchor: Dayjs,
    weekStart: 0 | 1 = 0
): { start: Dayjs; end: Dayjs } => {
    if (view === "month") {
        return monthVisibleRange(anchor.startOf("month"), weekStart);
    }
    const days = view === "week" ? 7 : view === "3day" ? 3 : 1;
    const start = view === "week" ? anchor.startOf("week") : anchor.startOf("day");
    return { start, end: start.add(days, "day").subtract(1, "millisecond") };
};

/** Ordered array of day buckets the TimelineView renders as
 *  columns. Convenience wrapper so the view doesn't have to
 *  recompute the column offsets. dayjs's `startOf("week")` uses
 *  locale-default week-start (Sunday in our default locale). */
export const timelineDays = (view: CalendarView, anchor: Dayjs): Dayjs[] => {
    if (view === "month") return []; // not applicable
    const days = view === "week" ? 7 : view === "3day" ? 3 : 1;
    const start = view === "week" ? anchor.startOf("week") : anchor.startOf("day");
    const out: Dayjs[] = [];
    for (let i = 0; i < days; i++) out.push(start.add(i, "day"));
    return out;
};

/**
 * Weekday labels in the same order as the grid columns. Short form
 * suitable for header chips ("Sun", "Mon", ...). Locale-aware via
 * `dayjs.weekdaysShort()`; falls back to English if locale data is
 * absent so tests/CI never blow up.
 */
export const weekdayLabels = (weekStart: 0 | 1 = 0): string[] => {
    const labels = (dayjs as unknown as { weekdaysShort?: () => string[] }).weekdaysShort?.() ?? [
        "Sun",
        "Mon",
        "Tue",
        "Wed",
        "Thu",
        "Fri",
        "Sat",
    ];
    return [...labels.slice(weekStart), ...labels.slice(0, weekStart)];
};
