import { fmt, getMessages } from "../../../../i18n";
import { formatDueLabel, type DueTone } from "../../utils/dashboardRowFormat";
import { deriveDaysLeft } from "../../utils/daysLeft";

export type { DueTone };

export type DueDisplay = { text: string; tone: DueTone };

/**
 * The due date as text plus a tone. Two wordings exist and both are kept (no
 * behaviour change): `card` is the board's ("Expired", "Due today", "3d left",
 * "No due date"); `row` is the dashboard's ("Overdue 16d", "Due tomorrow",
 * "Due Nov 12"). The tone, and so the color, is the same rule for both.
 */
export const dueDisplay = (
    dueDate: string | null | undefined,
    style: "card" | "row"
): DueDisplay => {
    if (style === "row") return formatDueLabel(dueDate ?? null);
    const b = getMessages().tasks.board;
    // Fresh from dueDate: the row's `daysLeft` is a stale server snapshot, and a
    // cleared date must not claim "Expired" off a stale negative.
    const days = dueDate ? deriveDaysLeft(dueDate) : null;
    if (days === null) return { text: b.noDueDate, tone: "none" };
    if (days < 0) return { text: b.expired, tone: "overdue" };
    if (days === 0) return { text: b.dueToday, tone: "today" };
    return { text: fmt(b.daysLeft, { count: days }), tone: days <= 3 ? "soon" : "later" };
};
