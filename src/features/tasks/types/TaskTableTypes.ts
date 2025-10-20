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
        lightModeColor: "#ff8c00ff",
        darkModeColor: "#ff8c00ff",
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
        label: "Low",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Low" }],
        },
        lightModeColor: "#0044c2",
        darkModeColor: "#0044c2",
    },
    {
        label: "Medium",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Medium" }],
        },
        lightModeColor: "#1dc200",
        darkModeColor: "#1dc200",
    },
    {
        label: "High",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "High" }],
        },
        lightModeColor: "#ff2323",
        darkModeColor: "#ff2323",
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
        label: "Low",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Low" }],
        },
        lightModeColor: "#0044c2",
        darkModeColor: "#0044c2",
    },
    {
        label: "Medium",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "Medium" }],
        },
        lightModeColor: "#1dc200",
        darkModeColor: "#1dc200",
    },
    {
        label: "High",
        filterModel: {
            items: [{ field: "effortLevel", operator: "equals", value: "High" }],
        },
        lightModeColor: "#ff2323",
        darkModeColor: "#ff2323",
    },
];
