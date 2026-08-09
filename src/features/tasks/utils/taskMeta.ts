import { TaskEffortLevelProps, TaskPriorityProps, TaskStatusProps } from "../../../types/tasks";

export const statuses: TaskStatusProps[] = [
    { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
    { code: 0, status: "WIP", color: "#ff8c00", textColor: "white" },
    // Rose, deliberately distinct from Deleted's bright red — the two
    // rarely co-occur in a view, but the chips must stay tellable-apart.
    { code: 0, status: "Blocked", color: "#e11d48", textColor: "white" },
    { code: 0, status: "Pending", color: "#b900ff", textColor: "white" },
    { code: 0, status: "Closed", color: "#1dc200", textColor: "white" },
    { code: 0, status: "Deleted", color: "#ff2323", textColor: "white" },
];

export const priorities: TaskPriorityProps[] = [
    { code: 0, priority: "Minimal", color: "#9CA3AF", textColor: "white" },
    { code: 0, priority: "Low", color: "#34D399", textColor: "white" },
    { code: 0, priority: "Normal", color: "#3B82F6", textColor: "white" },
    { code: 0, priority: "High", color: "#F59E0B", textColor: "white" },
    { code: 0, priority: "Critical", color: "#EF4444", textColor: "white" },
];

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
