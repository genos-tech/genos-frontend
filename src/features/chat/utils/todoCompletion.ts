import { TodoGroupProps, TodoItemProps } from "../../../types/chat";
import { getLocalCurrentDate } from "../../../utils/dateUtils";

/**
 * Helpers for the "Completed Today" view.
 *
 * `tsCompletedAt` has been persisted and serialized server-side all
 * along (`TodoItem.ts_completed_at`, set on every completion toggle) —
 * it simply was never read by the UI, so "what did I finish today?"
 * could only be answered by eyeballing the All tab.
 */

/**
 * Local calendar date (YYYY-MM-DD) of an ISO timestamp.
 *
 * Deliberately LOCAL, not UTC: a todo ticked at 09:00 JST is "today" to
 * the person who ticked it even though UTC still calls it yesterday.
 * Matches `getLocalCurrentDate`, which is what the group dates use.
 */
export const localDateOf = (iso: string): string | null => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return null;
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * Was this item completed today (viewer's local time)?
 *
 * Keyed on the completion timestamp, NOT on the group's date: finishing
 * a task today that you planned last week is exactly the case the tab
 * needs to catch, and its group still carries last week's date.
 *
 * An item completed before `ts_completed_at` shipped has `isCompleted`
 * true but no timestamp; it can't be attributed to a day, so it's
 * excluded rather than guessed into today.
 */
export const isCompletedToday = (item: TodoItemProps, today = getLocalCurrentDate()): boolean => {
    if (!item.isCompleted || !item.tsCompletedAt) return false;
    return localDateOf(item.tsCompletedAt) === today;
};

/**
 * Local completion stamp for a todo row — date AND time ("Jul 23 14:05").
 *
 * The date is load-bearing rather than decoration: on the All tab a
 * group's date is when the work was PLANNED, which is often not when it
 * was ticked off, so a bare clock time couldn't be placed. The year is
 * left to the row's tooltip, which carries the full timestamp.
 *
 * The date is locale-aware (matching `formatDueLabel`, the app's other
 * short-date renderer) while the time stays a fixed zero-padded 24h
 * `HH:mm`: it sits in a `tabular-nums` column, and a locale clock would
 * swing between "14:05" and "2:05 PM" and break that alignment.
 */
export const formatCompletedAt = (iso: string): string => {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "";
    const date = d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    const time = `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
    return `${date} ${time}`;
};

/**
 * Groups reduced to just the items completed today, dropping any group
 * left empty.
 *
 * Unlike the Incomplete filter this keeps NO empty group — an "add to
 * today" affordance would be noise on a view whose whole purpose is
 * reviewing what is already done.
 */
export const selectCompletedToday = (
    groups: TodoGroupProps[],
    today = getLocalCurrentDate()
): TodoGroupProps[] =>
    groups
        .map((g) => ({ ...g, items: g.items.filter((i) => isCompletedToday(i, today)) }))
        .filter((g) => g.items.length > 0);

/** Total items completed today across every group — the tab's count. */
export const countCompletedToday = (
    groups: TodoGroupProps[],
    today = getLocalCurrentDate()
): number =>
    groups.reduce((sum, g) => sum + g.items.filter((i) => isCompletedToday(i, today)).length, 0);
