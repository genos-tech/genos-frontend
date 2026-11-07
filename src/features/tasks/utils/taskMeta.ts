import { alpha } from "@mui/system";

import { TaskEffortLevelProps, TaskPriorityProps, TaskStatusProps } from "../../../types/tasks";
import { prioritySolid, statusSolid } from "../meta/taskTone";

// Colors come from the one tone source (MIP-1122): a solid fill and its label
// color, the same on every surface that shows the status.
export const statuses: TaskStatusProps[] = [
    { code: 0, status: "Open", ...statusSolid("Open") },
    { code: 0, status: "WIP", ...statusSolid("WIP") },
    { code: 0, status: "Blocked", ...statusSolid("Blocked") },
    { code: 0, status: "Pending", ...statusSolid("Pending") },
    { code: 0, status: "Closed", ...statusSolid("Closed") },
    { code: 0, status: "Deleted", ...statusSolid("Deleted") },
];

export const priorities: TaskPriorityProps[] = [
    { code: 0, priority: "Minimal", ...prioritySolid("Minimal") },
    { code: 0, priority: "Low", ...prioritySolid("Low") },
    { code: 0, priority: "Normal", ...prioritySolid("Normal") },
    { code: 0, priority: "High", ...prioritySolid("High") },
    { code: 0, priority: "Critical", ...prioritySolid("Critical") },
];

/**
 * Fill and label colour for a priority chip, derived from `priorities` the
 * same way the task table draws its priority chip: the priority's colour at
 * 75% (50% in dark mode) with its own label colour on top. The cards that
 * show a priority chip (sprint-board card, Assigned Milestones card) call
 * this instead of keeping a colour map of their own, so they cannot drift
 * from the table. Returns null for a value that is not one of `priorities`
 * (none set, or a legacy label such as "Medium"): the table shows no chip
 * for those either.
 */
export const priorityChipColors = (
    priority: string | null | undefined,
    isDark: boolean
): { bg: string; text: string } | null => {
    const meta = priorities.find((p) => p.priority === priority);
    if (!meta?.color) return null;
    return { bg: alpha(meta.color, isDark ? 0.5 : 0.75), text: meta.textColor ?? "white" };
};

export const effortLevels: TaskEffortLevelProps[] = [
    { code: 0, level: "Minimal", color: "#9CA3AF", textColor: "white" },
    { code: 0, level: "Low", color: "#34D399", textColor: "white" },
    { code: 0, level: "Moderate", color: "#3B82F6", textColor: "white" },
    { code: 0, level: "High", color: "#F59E0B", textColor: "white" },
    { code: 0, level: "Extensive", color: "#EF4444", textColor: "white" },
];

type TaskMetaLabels = Record<
    | "open"
    | "wip"
    | "blocked"
    | "pending"
    | "closed"
    | "deleted"
    | "minimal"
    | "low"
    | "normal"
    | "moderate"
    | "high"
    | "critical"
    | "extensive",
    string
>;

/** Translate API task metadata for display without changing its stored value. */
export const taskMetaLabel = (
    value: string | null | undefined,
    labels: TaskMetaLabels
): string => {
    if (!value) return "";
    const key = value.toLowerCase().replace(/\s+/g, "") as keyof TaskMetaLabels;
    return labels[key] ?? value;
};
