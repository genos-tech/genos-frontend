import { GridFilterModel } from "@mui/x-data-grid";

import { TaskTypesProps } from "../../../types/tasks";

export const taskTypes: TaskTypesProps = {
    all: { id: 0, statuses: ["Open", "WIP", "Pending", "Closed", "Deleted"], name: "All" },
    ongoing: { id: 1, statuses: ["Open", "WIP", "Pending"], name: "Ongoing" },
    closed: { id: 2, statuses: ["Closed"], name: "Closed" },
    deleted: { id: 3, statuses: ["Deleted"], name: "Deleted" },
};

export type FilterProps = {
    label: string;
    filterModel: GridFilterModel;
    lightModeColor: string;
    darkModeColor: string;
};

export const predefinedStatusFilters: FilterProps[] = [
    {
        label: "All",
        filterModel: {
            items: [],
        },
        lightModeColor: "#ffffff",
        darkModeColor: "#ffffff",
    },
    {
        label: "Open",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Open" }],
        },
        lightModeColor: "#002bff",
        darkModeColor: "#2b80ffff",
    },
    {
        label: "WIP",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "WIP" }],
        },
        lightModeColor: "#ff8c00",
        darkModeColor: "#ff8c00",
    },
    {
        label: "Pending",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Pending" }],
        },
        lightModeColor: "#b900ff",
        darkModeColor: "#b900ff",
    },
    {
        label: "Closed",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Closed" }],
        },
        lightModeColor: "#1dc200",
        darkModeColor: "#1dc200",
    },
    {
        label: "Expired",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Expired" }],
        },
        lightModeColor: "#ff2323",
        darkModeColor: "#ff2323",
    },
    {
        label: "Deleted",
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
        filterModel: {
            items: [],
        },
        lightModeColor: "#ffffff",
        darkModeColor: "#ffffff",
    },
    {
        label: "Minimal",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Minimal" }],
        },
        lightModeColor: "#9CA3AF",
        darkModeColor: "#9CA3AF",
    },
    {
        label: "Low",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Low" }],
        },
        lightModeColor: "#34D399",
        darkModeColor: "#34D399",
    },
    {
        label: "Normal",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Normal" }],
        },
        lightModeColor: "#3B82F6",
        darkModeColor: "#3B82F6",
    },
    {
        label: "High",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "High" }],
        },
        lightModeColor: "#F59E0B",
        darkModeColor: "#F59E0B",
    },
    {
        label: "Critical",
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
        filterModel: {
            items: [],
        },
        lightModeColor: "#ffffff",
        darkModeColor: "#ffffff",
    },
    {
        label: "Minimal",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Minimal" }],
        },
        lightModeColor: "#9CA3AF",
        darkModeColor: "#0044c2",
    },
    {
        label: "Low",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Low" }],
        },
        lightModeColor: "#34D399",
        darkModeColor: "#34D399",
    },
    {
        label: "Moderate",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Moderate" }],
        },
        lightModeColor: "#3B82F6",
        darkModeColor: "#3B82F6",
    },
    {
        label: "High",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "High" }],
        },
        lightModeColor: "#F59E0B",
        darkModeColor: "#F59E0B",
    },
    {
        label: "Extensive",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Extensive" }],
        },
        lightModeColor: "#EF4444",
        darkModeColor: "#EF4444",
    },
];
