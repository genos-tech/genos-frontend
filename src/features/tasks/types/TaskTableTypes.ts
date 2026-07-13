import { GridFilterModel } from "@mui/x-data-grid";

import { TaskTypesProps } from "../../../types/tasks";

export const taskTypes: TaskTypesProps = {
    all: {
        id: 0,
        statuses: ["Open", "WIP", "Blocked", "Pending", "Closed", "Deleted"],
        name: "All",
    },
    ongoing: { id: 1, statuses: ["Open", "WIP", "Blocked", "Pending"], name: "Ongoing" },
    closed: { id: 2, statuses: ["Closed"], name: "Closed" },
    deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
};

export type FilterProps = {
    // The rendered string. For predefined status / priority / effort
    // filters this is just an English fallback — the consuming UI
    // resolves the localized string via `labelKey` instead. For
    // dynamic (e.g. tag-based) filters the label IS the rendered
    // string because the tag name is user-supplied and not in the
    // i18n catalog.
    label: string;
    // When set, the consumer should look the rendered label up via
    // `t.tasks.filters[labelKey]`. Omitted for ad-hoc filters whose
    // label is user-supplied data (project tags, etc.).
    labelKey?: keyof (typeof import("../../../i18n/locales/en/tasks").tasks)["filters"];
    filterModel: GridFilterModel;
    lightModeColor: string;
    darkModeColor: string;
};

export const predefinedStatusFilters: FilterProps[] = [
    {
        label: "All",
        labelKey: "all",
        filterModel: {
            items: [],
        },
        lightModeColor: "#6b7280",
        darkModeColor: "#9ca3af",
    },
    {
        label: "Open",
        labelKey: "open",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Open" }],
        },
        lightModeColor: "#002bff",
        darkModeColor: "#2b80ffff",
    },
    {
        label: "WIP",
        labelKey: "wip",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "WIP" }],
        },
        lightModeColor: "#ff8c00",
        darkModeColor: "#ff8c00",
    },
    {
        label: "Blocked",
        labelKey: "blocked",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Blocked" }],
        },
        lightModeColor: "#e11d48",
        darkModeColor: "#fb7185",
    },
    {
        label: "Pending",
        labelKey: "pending",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Pending" }],
        },
        lightModeColor: "#b900ff",
        darkModeColor: "#b900ff",
    },
    {
        label: "Closed",
        labelKey: "closed",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Closed" }],
        },
        lightModeColor: "#1dc200",
        darkModeColor: "#1dc200",
    },
    {
        label: "Expired",
        labelKey: "expired",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Expired" }],
        },
        lightModeColor: "#ff2323",
        darkModeColor: "#ff2323",
    },
    {
        label: "Deleted",
        labelKey: "deleted",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Deleted" }],
        },
        lightModeColor: "#ff2323",
        darkModeColor: "#ff2323",
    },
];

export const predefinedPriorityFilters: FilterProps[] = [
    {
        label: "All",
        labelKey: "all",
        filterModel: {
            items: [],
        },
        lightModeColor: "#6b7280",
        darkModeColor: "#9ca3af",
    },
    {
        label: "Minimal",
        labelKey: "minimal",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Minimal" }],
        },
        lightModeColor: "#9CA3AF",
        darkModeColor: "#9CA3AF",
    },
    {
        label: "Low",
        labelKey: "low",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Low" }],
        },
        lightModeColor: "#34D399",
        darkModeColor: "#34D399",
    },
    {
        label: "Normal",
        labelKey: "normal",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Normal" }],
        },
        lightModeColor: "#3B82F6",
        darkModeColor: "#3B82F6",
    },
    {
        label: "High",
        labelKey: "high",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "High" }],
        },
        lightModeColor: "#F59E0B",
        darkModeColor: "#F59E0B",
    },
    {
        label: "Critical",
        labelKey: "critical",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Critical" }],
        },
        lightModeColor: "#EF4444",
        darkModeColor: "#EF4444",
    },
];

export const predefinedEffortLevelFilters: FilterProps[] = [
    {
        label: "All",
        labelKey: "all",
        filterModel: {
            items: [],
        },
        lightModeColor: "#6b7280",
        darkModeColor: "#9ca3af",
    },
    {
        label: "Minimal",
        labelKey: "minimal",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Minimal" }],
        },
        lightModeColor: "#9CA3AF",
        darkModeColor: "#0044c2",
    },
    {
        label: "Low",
        labelKey: "low",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Low" }],
        },
        lightModeColor: "#34D399",
        darkModeColor: "#34D399",
    },
    {
        label: "Moderate",
        labelKey: "moderate",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Moderate" }],
        },
        lightModeColor: "#3B82F6",
        darkModeColor: "#3B82F6",
    },
    {
        label: "High",
        labelKey: "high",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "High" }],
        },
        lightModeColor: "#F59E0B",
        darkModeColor: "#F59E0B",
    },
    {
        label: "Extensive",
        labelKey: "extensive",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Extensive" }],
        },
        lightModeColor: "#EF4444",
        darkModeColor: "#EF4444",
    },
];
