import { calendarDaysUntil, localCalendarIso, parseCalendarDate } from "../../utils/calendarDate";
import type { BriefingTask, BriefingToday } from "./briefingToday";

/**
 * The pure parts of the Today quick actions (MIP-1992): which day "tomorrow" is, and how the
 * briefing answer changes while a "Mark done" / "Move to tomorrow" is on its way. Kept out of
 * the components and the hook so the rules are tested without a DOM or a network.
 */

export type TodayAction = "done" | "tomorrow";

/**
 * The next working day after a calendar day (`YYYY-MM-DD`), Monday to Friday: Friday and the
 * weekend give Monday. Works on the calendar day itself, so it is the member's own day wherever
 * the browser is (the briefing's `window.localDate` is already in the member's time zone).
 * `null` for a date it cannot read.
 */
export const nextWorkingDay = (isoDay: string | null | undefined): string | null => {
    const base = parseCalendarDate(isoDay);
    if (!base) return null;
    const next = new Date(base.getFullYear(), base.getMonth(), base.getDate() + 1);
    // 6 = Saturday, 0 = Sunday.
    while (next.getDay() === 6 || next.getDay() === 0) {
        next.setDate(next.getDate() + 1);
    }
    return localCalendarIso(next);
};

/** Whole days from the member's today (`localDate`) to a day, for the row's due text. */
const daysBetween = (fromIso: string, toIso: string): number => {
    const from = parseCalendarDate(fromIso);
    return from ? (calendarDaysUntil(toIso, from) ?? 0) : 0;
};

const without = (list: BriefingTask[], taskId: number): BriefingTask[] =>
    list.filter((t) => t.taskId !== taskId);

/**
 * The briefing as it reads once `action` has happened to `task`.
 *
 * - The task leaves Overdue / Due today (their counts drop by the one row removed, never below 0).
 * - Done: it also leaves "Look at these first" and the blocked list, and the day's done count
 *   goes up by one, so the progress bar moves forward the same moment.
 * - Tomorrow: a copy in "Look at these first" keeps showing, with its new due day.
 *
 * Returns the same object when the task is on none of the lists.
 */
export const applyTodayAction = (
    d: BriefingToday,
    taskId: number,
    action: TodayAction,
    newDueDate: string | null
): BriefingToday => {
    const inOverdue = d.overdue.some((t) => t.taskId === taskId);
    const inDueToday = d.dueToday.some((t) => t.taskId === taskId);
    const inNext = d.suggestedNext.some((t) => t.taskId === taskId);
    const inBlocked = d.blocked.some((b) => b.taskId === taskId);
    if (!inOverdue && !inDueToday && !inNext && !inBlocked) return d;

    const next: BriefingToday = {
        ...d,
        overdue: without(d.overdue, taskId),
        overdueCount: Math.max(0, d.overdueCount - (inOverdue ? 1 : 0)),
        dueToday: without(d.dueToday, taskId),
        dueTodayCount: Math.max(0, d.dueTodayCount - (inDueToday ? 1 : 0)),
    };
    if (action === "done") {
        next.suggestedNext = without(d.suggestedNext, taskId);
        next.blocked = d.blocked.filter((b) => b.taskId !== taskId);
        // An older server does not say what was closed: no number to move, so no bar appears.
        if (d.doneToday) next.doneToday = { count: d.doneToday.count + 1 };
    } else if (newDueDate) {
        const today = d.window.localDate;
        next.suggestedNext = d.suggestedNext.map((t) =>
            t.taskId === taskId
                ? {
                      ...t,
                      dueDate: newDueDate,
                      daysUntilDue: today ? daysBetween(today, newDueDate) : undefined,
                  }
                : t
        );
    }
    return next;
};
