import { fmt } from "../../i18n";
import { formatDueLabel, type DueTone } from "../tasks/utils/dashboardRowFormat";
import type { BriefingTask, BriefingToday } from "./briefingToday";
import type { TodayCopy } from "./briefingWords";

/**
 * The pure parts of the Today view's top block (MIP-1992): the one-line summary of the day and
 * the progress toward today. Kept out of the components so the rules are tested without a DOM.
 */

/** "3 due today", "1 overdue", ...: only the parts that are not zero, most pressing first. */
export const summaryParts = (d: BriefingToday, a: TodayCopy): string[] => {
    const s = a.summary;
    const waiting = d.requests.length + d.mentions.length;
    const parts: [number, string][] = [
        [d.overdueCount, s.overdue],
        [d.dueTodayCount, s.dueToday],
        [waiting, s.waiting],
        [d.changed.total, s.changed],
    ];
    return parts.filter(([n]) => n > 0).map(([n, text]) => fmt(text, { n }));
};

/** The whole sentence: the parts joined, or "Nothing due today." when there are none. */
export const summarySentence = (d: BriefingToday, a: TodayCopy): string => {
    const parts = summaryParts(d, a);
    return parts.length === 0 ? a.summary.clear : parts.join(a.summary.join);
};

export type DayProgress = { done: number; left: number; planned: number };

/**
 * Done against planned. Planned is what was closed today plus what is still due or overdue, so
 * the bar only moves forward as the day goes. `null` when the API does not say what was closed
 * (an older server) or when there was nothing planned: no empty bar.
 */
export const progressOf = (d: BriefingToday): DayProgress | null => {
    if (!d.doneToday) return null;
    const done = Math.max(0, d.doneToday.count);
    const left = d.overdueCount + d.dueTodayCount;
    const planned = done + left;
    return planned > 0 ? { done, left, planned } : null;
};

/** Greeting by the viewer's local hour. */
export const greetingKey = (hour: number): "morning" | "afternoon" | "evening" =>
    hour < 12 ? "morning" : hour < 18 ? "afternoon" : "evening";

/** How urgent the due date is, in words. The server's `daysUntilDue` is the member's own day. */
export const dueOf = (
    task: BriefingTask,
    a: TodayCopy,
    locale: string
): { text: string; tone: DueTone } | null => {
    const days = task.daysUntilDue;
    if (days != null && days < 0) {
        return {
            text: days === -1 ? a.overdueByOne : fmt(a.overdueBy, { n: -days }),
            tone: "overdue",
        };
    }
    if (days === 0) return { text: a.dueToday, tone: "today" };
    if (task.dueDate) return formatDueLabel(task.dueDate, locale as never);
    return null;
};
