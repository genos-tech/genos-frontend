/**
 * What a project calls a task's status (MIP-2493; the backend is MIP-2492).
 *
 * `status` stays one of the system values (the CATEGORY: columns, filters, automations).
 * A project that has set up statuses names and colours them, and a task may point at one
 * (`customStatusId`). A task reads as:
 *   1. its status row, while that row's category equals `status`;
 *   2. otherwise the project's default row of that category;
 *   3. otherwise the built-in label, as a project with no rows always does.
 */
import { IN_REVIEW_COLOR } from "../../../theme/tokens/statusPalette";
import type { ProjectStatusDef } from "../../../types/tasks";
import { WORKFLOW_STATUS_NAMES } from "../meta/taskStatuses";
import { statusTone, toneCss } from "../meta/taskTone";

/** The categories a project status can belong to, in order. */
export const STATUS_CATEGORIES: readonly string[] = WORKFLOW_STATUS_NAMES;

export const IN_REVIEW_KEY = "In Review";

/** The built-in statuses a project is set up with: each category's own, and In Review. */
export const BUILTIN_STATUSES: readonly { key: string; category: string }[] =
    STATUS_CATEGORIES.flatMap((category) => {
        const own = [{ key: category, category }];
        // In Review is a "not started" status, between Open and WIP.
        return category === STATUS_CATEGORIES[0]
            ? [...own, { key: IN_REVIEW_KEY, category }]
            : own;
    });

export const MAX_STATUSES = 30;
export const MAX_STATUS_NAME = 24;

const COLOR_RE = /^(#[0-9a-fA-F]{6}|[A-Za-z][A-Za-z0-9-]{0,23})$/;

export const resolveStatusRow = (
    rows: readonly ProjectStatusDef[],
    status: string | null | undefined,
    customStatusId?: number | null
): ProjectStatusDef | undefined => {
    if (!rows.length || !status) return undefined;
    const own =
        customStatusId != null
            ? rows.find((r) => r.statusId === customStatusId && r.category === status)
            : undefined;
    return own ?? rows.find((r) => r.category === status && r.isDefault && !r.isArchived);
};

type StatusWords = {
    filters: Record<string, string>;
    projectStatuses: { inReview: string };
};

/** The row's name: a built-in nobody renamed is translated, anything typed is shown as typed. */
export const statusRowName = (row: ProjectStatusDef, words: StatusWords): string => {
    if (!row.builtinKey || row.name !== row.builtinKey) return row.name;
    if (row.builtinKey === IN_REVIEW_KEY) return words.projectStatuses.inReview;
    return words.filters[row.builtinKey.toLowerCase()] ?? row.name;
};

/** The colour of the row's icon: its own, or the category's. */
export const statusColorCss = (color: string | null | undefined, category: string): string => {
    if (color && COLOR_RE.test(color)) return color;
    return toneCss(statusTone(category)).text;
};

export const rowColorCss = (row: ProjectStatusDef): string =>
    statusColorCss(
        row.color || (row.builtinKey === IN_REVIEW_KEY ? IN_REVIEW_COLOR : ""),
        row.category
    );

export const sortStatuses = (rows: readonly ProjectStatusDef[]): ProjectStatusDef[] =>
    [...rows].sort(
        (a, b) =>
            STATUS_CATEGORIES.indexOf(a.category) - STATUS_CATEGORIES.indexOf(b.category) ||
            a.sortOrder - b.sortOrder ||
            a.statusId - b.statusId
    );

/**
 * What a status picker offers: the rows that are on, grouped by category order. The task's
 * own row stays offered when it was turned off, so the picker never shows an empty value.
 */
export const pickableStatuses = (
    rows: readonly ProjectStatusDef[],
    currentId?: number | null
): ProjectStatusDef[] =>
    sortStatuses(rows).filter(
        (r) =>
            STATUS_CATEGORIES.includes(r.category) && (!r.isArchived || r.statusId === currentId)
    );

/** The stored custom status once `status` is written by something other than a status pick:
 *  the server drops it when the category changes. */
export const keptCustomStatusId = (
    previousStatus: string | null | undefined,
    nextStatus: string | null | undefined,
    customStatusId: number | null | undefined
): number | null | undefined => (previousStatus === nextStatus ? customStatusId : null);
