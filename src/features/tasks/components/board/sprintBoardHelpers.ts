import React from "react";

import type { ProjectStatusDef, TaskTableProps } from "../../../../types/tasks";
import { STATUS_TONE, statusSolid, toneSoftBg } from "../../meta/taskTone";
import { bucketByStatus, statusColumnSpecs } from "../../utils/boardStatusColumns";
import { rowColorCss } from "../../utils/projectStatus";
import { COLUMN_MIN_WIDTH, ColumnConfig } from "./SprintBoardColumn";

// Sort tiers (priority/due-date/etc. ranking, comparator builder) now
// live in features/tasks/utils/sortTask.ts so the sprint board and the
// task table share one set of rank maps. Selection is owned by the
// Settings modal via `useTaskSortPreferences`.

// Column definitions. `title` is filled in at render time from the
// `titleKey` so the board columns stay localizable while `status` stays
// the backend enum value the filterModel keys off.
export const COLUMNS: ColumnConfig[] = [
    {
        id: "open",
        title: "Open",
        titleKey: "columnOpen",
        status: "Open",
        color: statusSolid("Open").color,
        bgColor: toneSoftBg(STATUS_TONE.Open, 0.1),
    },
    {
        id: "wip",
        title: "Work In Progress",
        titleKey: "columnWip",
        status: "WIP",
        color: statusSolid("WIP").color,
        bgColor: toneSoftBg(STATUS_TONE.WIP, 0.1),
    },
    {
        id: "blocked",
        title: "Blocked",
        titleKey: "columnBlocked",
        status: "Blocked",
        color: statusSolid("Blocked").color,
        bgColor: toneSoftBg(STATUS_TONE.Blocked, 0.1),
    },
    {
        id: "closed",
        title: "Closed",
        titleKey: "columnClosed",
        status: "Closed",
        color: statusSolid("Closed").color,
        bgColor: toneSoftBg(STATUS_TONE.Closed, 0.1),
    },
    {
        id: "pending",
        title: "Pending",
        titleKey: "columnPending",
        status: "Pending",
        color: statusSolid("Pending").color,
        bgColor: toneSoftBg(STATUS_TONE.Pending, 0.1),
    },
    {
        id: "rejected",
        title: "Rejected",
        titleKey: "columnRejected",
        status: "Rejected",
        color: statusSolid("Rejected").color,
        bgColor: toneSoftBg(STATUS_TONE.Rejected, 0.1),
        onlyWithCards: true,
    },
];

/** The columns a board draws: Rejected only once the board holds a rejected card. */
export const visibleColumns = (boardTasks: Record<string, readonly unknown[]>): ColumnConfig[] =>
    COLUMNS.filter((column) => !column.onlyWithCards || (boardTasks[column.id]?.length ?? 0) > 0);

const categoryColumns = COLUMNS.map((c) => ({
    id: c.id,
    category: c.status,
    onlyWithCards: c.onlyWithCards,
}));

/** The cards by column id. With `statusRows` (the "one column per status" option, MIP-2495)
 *  the category buckets are spread over the project's statuses. */
export const boardBuckets = (
    statusRows: readonly ProjectStatusDef[] | null,
    byCategory: Record<string, TaskTableProps[]>
): Record<string, TaskTableProps[]> =>
    statusRows ? bucketByStatus(statusRows, categoryColumns, byCategory) : byCategory;

/** The columns the board draws. */
export const boardColumns = (
    statusRows: readonly ProjectStatusDef[] | null,
    boardTasks: Record<string, readonly unknown[]>
): ColumnConfig[] => {
    if (!statusRows) return visibleColumns(boardTasks);
    return statusColumnSpecs(statusRows, categoryColumns, boardTasks).map((spec) => {
        const base = COLUMNS.find((c) => c.status === spec.category)!;
        return {
            ...base,
            id: spec.id,
            color: spec.row ? rowColorCss(spec.row) : base.color,
            row: spec.row ?? undefined,
            categoryStart: spec.categoryStart,
        };
    });
};

// Style helpers
export const getBoardContainerStyles = (
    mode: "light" | "dark" | undefined,
    columnCount: number
): React.CSSProperties => ({
    display: "grid",
    // One column per status, each at least COLUMN_MIN_WIDTH wide. The
    // `1fr` upper bound still shares leftover space equally when the pane
    // is roomy (so a wide board looks exactly as it always did), but the
    // `minmax` floor stops columns collapsing into unreadable slivers
    // when the window narrows or a preview pane opens alongside — past
    // that point the board scrolls horizontally instead (`overflowX`
    // below). `1fr` alone resolves its implicit `auto` minimum against
    // the content and would keep shrinking.
    gridTemplateColumns: `repeat(${columnCount}, minmax(${COLUMN_MIN_WIDTH}px, 1fr))`,
    // One row exactly as tall as the board, so every column fills it and
    // scrolls its own cards (SprintBoardColumn). `minmax(0, …)` rather than
    // plain `1fr`: a tall column must not stretch the row past the board.
    gridTemplateRows: "minmax(0, 1fr)",
    gap: 12,
    padding: 12,
    flex: 1,
    minHeight: 0,
    width: "100%",
    // The board scrolls sideways only, once the columns hit their min
    // width; vertical scrolling belongs to each column. While a card is
    // being dragged the columns stop scrolling so this is the only scroll
    // parent dnd sees, which is what lets it scroll the board sideways to
    // off-screen columns (see the note in SprintBoardColumn).
    overflowX: "auto",
    overflowY: "hidden",
    backgroundColor: mode === "dark" ? "#0a0a10" : "#f4f5f7",
    borderRadius: 12,
});
