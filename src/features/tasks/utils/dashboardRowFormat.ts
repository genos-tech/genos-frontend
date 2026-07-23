import { fmt, getMessages } from "../../../i18n";
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
export const formatDueLabel = (dueDate: string | null): { text: string; tone: DueTone } => {
    const labels = getMessages().tasks.dueLabel;
    if (!dueDate) return { text: labels.noDueDate, tone: "none" };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const d = new Date(dueDate);
    d.setHours(0, 0, 0, 0);
    const diffDays = Math.round((d.getTime() - today.getTime()) / 86400000);
    if (diffDays < 0) return { text: fmt(labels.overdue, { days: -diffDays }), tone: "overdue" };
    if (diffDays === 0) return { text: labels.dueToday, tone: "today" };
    if (diffDays === 1) return { text: labels.dueTomorrow, tone: "soon" };
    if (diffDays <= 6) {
        return {
            text: fmt(labels.dueOn, {
                when: d.toLocaleDateString(undefined, { weekday: "short" }),
            }),
            tone: "soon",
        };
    }
    return {
        text: fmt(labels.dueOn, {
            when: d.toLocaleDateString(undefined, { month: "short", day: "numeric" }),
        }),
        tone: "later",
    };
};
