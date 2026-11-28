/**
 * The table's status filter in a project that set up its own statuses (MIP-2495).
 *
 * The selection stays ONE list: the built-in filters (All, the categories, Expired, Deleted)
 * plus one entry per picked project status, labelled `st:<id>`. An id is all such an entry
 * holds, so it restores before the project's statuses are read, and its name is looked up
 * when it is drawn. Stored apart as `statusIds`, so a stored blob stays plain.
 *
 * A task matches when its (effective) status is a picked category OR the status it reads as is
 * picked. Pure, so it is unit-tested without the filter bar.
 */
import type { ProjectStatusDef } from "../../../types/tasks";
import { predefinedStatusFilters, type FilterProps } from "../types/TaskTableTypes";
import { resolveStatusRow, sortStatuses, STATUS_CATEGORIES } from "./projectStatus";
import { rehydrateFilters } from "./taskFilterStorage";

const PREFIX = "st:";

export const pickedStatusId = (filter: FilterProps): number | null =>
    filter.label.startsWith(PREFIX) ? Number(filter.label.slice(PREFIX.length)) : null;

export const statusPick = (statusId: number): FilterProps => ({
    label: `${PREFIX}${statusId}`,
    filterModel: { items: [] },
    // Only the older chips read these; a project status is drawn by its own row.
    lightModeColor: predefinedStatusFilters[0].lightModeColor,
    darkModeColor: predefinedStatusFilters[0].darkModeColor,
});

const allFilter = predefinedStatusFilters[0];
const filterByLabel = (label: string) => predefinedStatusFilters.find((f) => f.label === label)!;

/** The stored halves of a selection. `statusIds` is left out when there are none. */
export const splitStatusSelection = (
    selection: readonly FilterProps[]
): { status: string[]; statusIds?: number[] } => {
    const status: string[] = [];
    const statusIds: number[] = [];
    for (const filter of selection) {
        if (filter == null) continue;
        const id = pickedStatusId(filter);
        if (id == null) status.push(filter.label);
        else statusIds.push(id);
    }
    return statusIds.length ? { status, statusIds } : { status };
};

/** Back from storage. Ids alone are a whole selection: the labels' fallback is not added. */
export const restoreStatusSelection = (
    status: string[] | undefined,
    statusIds: readonly (string | number)[] | undefined,
    available: FilterProps[],
    fallback: FilterProps[]
): FilterProps[] => {
    const picks = (statusIds ?? [])
        .map(Number)
        .filter((id) => Number.isInteger(id) && id > 0)
        .map(statusPick);
    if (!picks.length) return rehydrateFilters(status, available, fallback);
    return [...rehydrateFilters(status, available, []), ...picks];
};

/** Drop the picks the project no longer has; `fallback` when nothing is left. Returns the
 *  same list when there was nothing to drop. */
export const pruneStatusPicks = (
    selection: FilterProps[],
    rows: readonly ProjectStatusDef[],
    fallback: FilterProps[]
): FilterProps[] => {
    const known = new Set(rows.map((r) => r.statusId));
    const kept = selection.filter((f) => {
        const id = pickedStatusId(f);
        return id == null || known.has(id);
    });
    if (kept.length === selection.length) return selection;
    return kept.length ? kept : fallback;
};

/** The statuses a category offers under it: those that are on, and any that is picked. */
export const subStatuses = (
    rows: readonly ProjectStatusDef[],
    category: string,
    selection: readonly FilterProps[]
): ProjectStatusDef[] => {
    const picked = new Set(selection.map(pickedStatusId));
    const own = sortStatuses(rows).filter(
        (r) => r.category === category && (!r.isArchived || picked.has(r.statusId))
    );
    // One status that is on IS the category; there is nothing to choose between.
    return own.length > 1 || own.some((r) => picked.has(r.statusId)) ? own : [];
};

const settled = (next: FilterProps[]): FilterProps[] => (next.length ? next : [allFilter]);

const withoutAll = (selection: readonly FilterProps[]) =>
    selection.filter((f) => f.label !== "All");

const categoryOfPick = (rows: readonly ProjectStatusDef[], filter: FilterProps) => {
    const id = pickedStatusId(filter);
    return id == null ? undefined : rows.find((r) => r.statusId === id)?.category;
};

/** A category row was clicked: the whole category on or off. */
export const toggleCategory = (
    selection: readonly FilterProps[],
    rows: readonly ProjectStatusDef[],
    category: string
): FilterProps[] => {
    if (selection.some((f) => f.label === category)) {
        return settled(selection.filter((f) => f.label !== category));
    }
    return [
        ...withoutAll(selection).filter((f) => categoryOfPick(rows, f) !== category),
        filterByLabel(category),
    ];
};

/** A status row was clicked. */
export const toggleStatus = (
    selection: readonly FilterProps[],
    rows: readonly ProjectStatusDef[],
    row: ProjectStatusDef
): FilterProps[] => {
    const { category, statusId } = row;
    const on = rows.filter((r) => r.category === category && !r.isArchived);
    // The whole category was picked: it becomes its other statuses.
    if (selection.some((f) => f.label === category)) {
        return settled([
            ...selection.filter((f) => f.label !== category),
            ...on.filter((r) => r.statusId !== statusId).map((r) => statusPick(r.statusId)),
        ]);
    }
    if (selection.some((f) => pickedStatusId(f) === statusId)) {
        return settled(selection.filter((f) => pickedStatusId(f) !== statusId));
    }
    const next = [...withoutAll(selection), statusPick(statusId)];
    const picked = new Set(next.map(pickedStatusId));
    // Every status of the category is picked: say the category.
    if (on.length > 1 && on.every((r) => picked.has(r.statusId))) {
        return [
            ...next.filter((f) => categoryOfPick(rows, f) !== category),
            filterByLabel(category),
        ];
    }
    return next;
};

/** The selection in the order the menu lists it, which is what the chip names first. */
export const orderStatusSelection = (
    selection: readonly FilterProps[],
    rows: readonly ProjectStatusDef[]
): FilterProps[] => {
    const sorted = sortStatuses(rows);
    const rank = (filter: FilterProps): number => {
        const id = pickedStatusId(filter);
        if (id == null) {
            const category = STATUS_CATEGORIES.indexOf(filter.label);
            if (category >= 0) return category * 100;
            return filter.label === "All" ? -1 : 10_000 + predefinedStatusFilters.indexOf(filter);
        }
        const index = sorted.findIndex((r) => r.statusId === id);
        if (index < 0) return 9_999;
        return STATUS_CATEGORIES.indexOf(sorted[index].category) * 100 + 1 + index;
    };
    return [...selection].sort((a, b) => rank(a) - rank(b));
};

/** The status half of the table's predicate: null when the selection names no status. */
export const statusMatcher = (
    selection: readonly FilterProps[],
    rows: readonly ProjectStatusDef[]
): ((effective: string, customStatusId: number | null | undefined) => boolean) | null => {
    if (selection.some((f) => f.label === "All")) return null;
    const labels = new Set<string>();
    const ids = new Set<number>();
    for (const filter of selection) {
        const id = pickedStatusId(filter);
        if (id != null) ids.add(id);
        // "Expired" narrows by due date, not by status.
        else if (filter.label !== "Expired") labels.add(filter.label);
    }
    if (!labels.size && !ids.size) return null;
    return (effective, customStatusId) => {
        if (labels.has(effective)) return true;
        if (!ids.size) return false;
        const row = resolveStatusRow(rows, effective, customStatusId);
        return row != null && ids.has(row.statusId);
    };
};

/** The labels the lazy load goes by: a picked status needs its category's rows. Null while
 *  a pick's category is not known yet (the statuses are still being read). */
export const statusScopeLabels = (
    selection: readonly FilterProps[],
    rows: readonly ProjectStatusDef[]
): string[] | null => {
    const labels: string[] = [];
    let unknown = false;
    for (const filter of selection) {
        if (pickedStatusId(filter) == null) labels.push(filter.label);
        else {
            const category = categoryOfPick(rows, filter);
            if (category) labels.push(category);
            else unknown = true;
        }
    }
    return unknown && !labels.length ? null : labels;
};
