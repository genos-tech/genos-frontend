import { fmt, getMessages, type Locale } from "../../../i18n";
import { calendarDaysUntil, parseCalendarDate } from "../../../utils/calendarDate";
import { predefinedPriorityFilters } from "../types/TaskTableTypes";

// Pure formatting helpers for the dashboard task rows. Kept out of
// `DashboardTaskRow.tsx` so that file only exports its component —
// mixing component and non-component exports breaks Fast Refresh.

// Priority swatches sourced from `predefinedPriorityFilters` so the
// dashboard chip stays in lockstep with the table's filter chips.
// `light` / `dark` are kept separate even though the current palette
// happens to match across modes — keeps the lookup honest for future
// per-mode tweaks. Non-priority labels (e.g. the "All" filter row) are
// skipped at build time.
export const PRIORITY_COLORS: Record<string, { light: string; dark: string }> = Object.fromEntries(
    predefinedPriorityFilters
        .filter((f) => f.label !== "All")
        .map((f) => [f.label, { light: f.lightModeColor, dark: f.darkModeColor }])
);

export type DueTone = "overdue" | "today" | "soon" | "later" | "none";

// Compact, human-readable due-date label. `tone` lets the caller pick the
// right color without re-parsing the date.
// Wording and date come from the same `locale` (the app's, from `useTranslation()`), never the browser's.
export const formatDueLabel = (
    dueDate: string | null,
    locale: Locale
): { text: string; tone: DueTone } => {
    const labels = getMessages(locale).tasks.dueLabel;
    if (!dueDate) return { text: labels.noDueDate, tone: "none" };
    // A calendar day, not a UTC instant (MIP-1811).
    const d = parseCalendarDate(dueDate);
    const diffDays = calendarDaysUntil(dueDate);
    if (d == null || diffDays == null) return { text: labels.noDueDate, tone: "none" };
    if (diffDays < 0) return { text: fmt(labels.overdue, { days: -diffDays }), tone: "overdue" };
    if (diffDays === 0) return { text: labels.dueToday, tone: "today" };
    if (diffDays === 1) return { text: labels.dueTomorrow, tone: "soon" };
    if (diffDays <= 6) {
        return {
            text: fmt(labels.dueOn, {
                when: d.toLocaleDateString(locale, { weekday: "short" }),
            }),
            tone: "soon",
        };
    }
    return {
        text: fmt(labels.dueOn, {
            when: d.toLocaleDateString(locale, { month: "short", day: "numeric" }),
        }),
        tone: "later",
    };
};
