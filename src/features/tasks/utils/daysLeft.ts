import dayjs from "dayjs";

/**
 * Days until a task's due date, derived FRESH from `dueDate` at call time.
 *
 * Use this instead of the row's `daysLeft` field. That field is computed
 * server-side at FETCH time and cached (Redis + IDB), so it goes stale
 * across a day boundary or on a cache hit — the number stops matching
 * reality until the next fetch. Deriving from `dueDate` on each render/sort
 * keeps it current (fresh as of the last render, which self-heals on any
 * interaction; a static table across midnight is the only residual gap and
 * isn't worth a timer).
 *
 * Semantics match the server (`max(-1, (due - today).days)`):
 *   - `null` when there's no due date (or it can't be parsed);
 *   - the signed whole-day delta otherwise, CLAMPED so ANY overdue date
 *     returns exactly `-1` — the "Expired" sentinel every consumer keys on
 *     (the table chip, taskWeight, hover/board cards, sort). Callers must
 *     keep treating `-1` as "expired", not "1 day overdue".
 */
export const deriveDaysLeft = (dueDate: string | null | undefined): number | null => {
    if (!dueDate) return null;
    const due = dayjs(dueDate);
    if (!due.isValid()) return null;
    return Math.max(-1, due.startOf("day").diff(dayjs().startOf("day"), "day"));
};
