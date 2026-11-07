import { GridFilterModel } from "@mui/x-data-grid";

import { TaskTypesProps } from "../../../types/tasks";
import { PRIORITY_TONE, STATUS_TONE, Tone, toneBase, toneSolid } from "../meta/taskTone";

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

/**
 * Filter-chip colors from the one tone source (MIP-1122). The filter menu does
 * `alpha()` math on them, so they are real hex: a solid fill in light mode and
 * the lighter 500 stop in dark mode (the old convention, kept so the chips do
 * not change shape). "All" is neutral; "Expired" (past due) is danger.
 */
const filterColors = (tone: Tone) => ({
    lightModeColor: toneSolid(tone).bg,
    darkModeColor: tone === "neutral" ? toneBase("muted") : toneBase(tone),
});

export const predefinedStatusFilters: FilterProps[] = [
    {
        label: "All",
        labelKey: "all",
        filterModel: {
            items: [],
        },
        ...filterColors("neutral"),
    },
    {
        label: "Open",
        labelKey: "open",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Open" }],
        },
        ...filterColors(STATUS_TONE.Open),
    },
    {
        label: "WIP",
        labelKey: "wip",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "WIP" }],
        },
        ...filterColors(STATUS_TONE.WIP),
    },
    {
        label: "Blocked",
        labelKey: "blocked",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Blocked" }],
        },
        ...filterColors(STATUS_TONE.Blocked),
    },
    {
        label: "Pending",
        labelKey: "pending",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Pending" }],
        },
        ...filterColors(STATUS_TONE.Pending),
    },
    {
        label: "Closed",
        labelKey: "closed",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Closed" }],
        },
        ...filterColors(STATUS_TONE.Closed),
    },
    {
        label: "Expired",
        labelKey: "expired",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Expired" }],
        },
        ...filterColors("danger"),
    },
    {
        label: "Deleted",
        labelKey: "deleted",
        filterModel: {
            items: [{ field: "status", operator: "equals", value: "Deleted" }],
        },
        ...filterColors(STATUS_TONE.Deleted),
    },
];

export const predefinedPriorityFilters: FilterProps[] = [
    {
        label: "All",
        labelKey: "all",
        filterModel: {
            items: [],
        },
        ...filterColors("neutral"),
    },
    {
        label: "Minimal",
        labelKey: "minimal",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Minimal" }],
        },
        ...filterColors(PRIORITY_TONE.Minimal),
    },
    {
        label: "Low",
        labelKey: "low",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Low" }],
        },
        ...filterColors(PRIORITY_TONE.Low),
    },
    {
        label: "Normal",
        labelKey: "normal",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Normal" }],
        },
        ...filterColors(PRIORITY_TONE.Normal),
    },
    {
        label: "High",
        labelKey: "high",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "High" }],
        },
        ...filterColors(PRIORITY_TONE.High),
    },
    {
        label: "Critical",
        labelKey: "critical",
        filterModel: {
            items: [{ field: "priority", operator: "equals", value: "Critical" }],
        },
        ...filterColors(PRIORITY_TONE.Critical),
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
