/**
 * The board's "one column per status" option (MIP-2495): which columns a project that set up
 * its statuses draws, and which of them a card sits in. Pure, so it is unit-tested without the
 * board. With the option off the board never comes here.
 */
import type { ProjectStatusDef, TaskTableProps } from "../../../types/tasks";
import { resolveStatusRow, sortStatuses } from "./projectStatus";

export const statusColumnId = (statusId: number): string => `st:${statusId}`;

export type StatusColumnSpec = {
    /** `st:<id>` for a status, the category's own column id otherwise. */
    id: string;
    category: string;
    /** Null: the plain category column of a category with no status turned on. */
    row: ProjectStatusDef | null;
    /** The first column of its category (not of the board): drawn a little apart. */
    categoryStart: boolean;
};

type Category = {
    /** The category column's id (`open`, `wip`, ...). */
    id: string;
    category: string;
    /** Drawn only while it holds cards (Rejected). */
    onlyWithCards?: boolean;
};

/**
 * Move cards from their category buckets (by EFFECTIVE status, see `bucketBoardColumns`) into
 * status columns: the card's own status, else the category's default, else its first status
 * that is on, else the category column.
 */
export const bucketByStatus = (
    rows: readonly ProjectStatusDef[],
    categories: readonly Category[],
    byCategory: Readonly<Record<string, TaskTableProps[]>>
): Record<string, TaskTableProps[]> => {
    const sorted = sortStatuses(rows);
    const buckets: Record<string, TaskTableProps[]> = {};
    for (const { id } of categories) buckets[id] = [];
    for (const row of sorted) buckets[statusColumnId(row.statusId)] = [];
    for (const { id, category } of categories) {
        const firstOn = sorted.find((r) => r.category === category && !r.isArchived);
        for (const task of byCategory[id] ?? []) {
            const row = resolveStatusRow(sorted, category, task.customStatusId) ?? firstOn;
            buckets[row ? statusColumnId(row.statusId) : id].push(task);
        }
    }
    return buckets;
};

/**
 * The columns, in the board's category order and the project's status order. A status that is
 * off has a column only while it holds cards; a category with none on keeps its plain column,
 * so every category can still be dropped into.
 */
export const statusColumnSpecs = (
    rows: readonly ProjectStatusDef[],
    categories: readonly Category[],
    buckets: Readonly<Record<string, readonly unknown[]>>
): StatusColumnSpec[] => {
    const sorted = sortStatuses(rows);
    const count = (id: string) => buckets[id]?.length ?? 0;
    const specs: StatusColumnSpec[] = [];
    for (const { id, category, onlyWithCards } of categories) {
        const own = sorted.filter((r) => r.category === category);
        const columns: Omit<StatusColumnSpec, "categoryStart">[] = own
            .filter((row) => {
                const holds = count(statusColumnId(row.statusId)) > 0;
                return holds || (!row.isArchived && !onlyWithCards);
            })
            .map((row) => ({ id: statusColumnId(row.statusId), category, row }));
        if (own.every((r) => r.isArchived) && (!onlyWithCards || count(id) > 0)) {
            columns.unshift({ id, category, row: null });
        }
        columns.forEach((column, index) =>
            specs.push({ ...column, categoryStart: index === 0 && specs.length > 0 })
        );
    }
    return specs;
};

/** Where the quick-add "+" goes: the column a new task (Open, no status picked) lands in. */
export const quickAddColumnId = (rows: readonly ProjectStatusDef[], openId: string): string => {
    const category = "Open";
    const sorted = sortStatuses(rows);
    const row =
        resolveStatusRow(sorted, category) ??
        sorted.find((r) => r.category === category && !r.isArchived);
    return row ? statusColumnId(row.statusId) : openId;
};
