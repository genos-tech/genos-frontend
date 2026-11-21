// Comparisons of a task's due date / a sprint's window with "today", as CALENDAR days in the
// viewer's zone (MIP-1816; MIP-1811 is the display twin). A task due today is NOT overdue: it is
// due today, and overdue starts the day after, so the lists and counts agree with the
// "Due today" label on the same row.

import { calendarDayMs, calendarDaysUntil, parseCalendarDate } from "../../../utils/calendarDate";

/** The due day is before the viewer's today. Unparseable / empty is never overdue. */
export const isOverdueDate = (
    dueDate: string | null | undefined,
    now: Date = new Date()
): boolean => (calendarDaysUntil(dueDate, now) ?? 0) < 0;

/** Due today or within the next `days` days (default a week). */
export const isDueWithin = (
    dueDate: string | null | undefined,
    now: Date = new Date(),
    days = 7
): boolean => {
    const n = calendarDaysUntil(dueDate, now);
    return n != null && n >= 0 && n <= days;
};

/** A sprint's window in ms: local midnight of its first day to the last millisecond of its last day. */
export const sprintWindowMs = (
    startDate: string,
    endDate: string
): { start: number; end: number } => {
    const end = parseCalendarDate(endDate);
    return {
        start: calendarDayMs(startDate),
        end: end
            ? new Date(end.getFullYear(), end.getMonth(), end.getDate() + 1).getTime() - 1
            : new Date(endDate).getTime(),
    };
};

/** The "expired" task filter: the due day is before `todayStart` (local midnight, ms). */
export const isExpiredDue = (dueDate: string, todayStart: number): boolean => {
    const ts = calendarDayMs(dueDate);
    return Number.isFinite(ts) && ts < todayStart;
};
