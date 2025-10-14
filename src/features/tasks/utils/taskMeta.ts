import { TaskEffortLevelProps, TaskPriorityProps, TaskStatusProps } from "../../../types/tasks";

export const statuses: TaskStatusProps[] = [
    { code: 0, status: "Open", color: "#0044c2", textColor: "white" },
    { code: 0, status: "WIP", color: "#ff8c00ff", textColor: "white" },
    { code: 0, status: "Pending", color: "#b900ff", textColor: "white" },
    { code: 0, status: "Closed", color: "#1dc200", textColor: "white" },
    { code: 0, status: "Deleted", color: "#ff2323", textColor: "white" },
];

export const priorities: TaskPriorityProps[] = [
    { code: 0, priority: "Low", color: "#0044c2", textColor: "white" },
    { code: 0, priority: "Medium", color: "#1dc200", textColor: "white" },
    { code: 0, priority: "High", color: "#ff2323", textColor: "white" },
];

export const effortLevels: TaskEffortLevelProps[] = [
    { code: 0, level: "Low", color: "#0044c2", textColor: "white" },
    { code: 0, level: "Medium", color: "#1dc200", textColor: "white" },
    { code: 0, level: "High", color: "#ff2323", textColor: "white" },
];
