/**
 * Which quick status buttons an item offers (MIP-2603).
 *
 * An action belongs to one status row, not to a category: a task in the team's "QA" offers the
 * QA actions only. The row an item is in is the one its chip reads (`resolveStatusRow`). A
 * project that never set up statuses has no rows, and its computed defaults are matched by the
 * system status.
 */
import type { ProjectStatusAction, ProjectStatusDef } from "../../../types/tasks";
import { IN_REVIEW_KEY, resolveStatusRow } from "./projectStatus";

export type QuickAction = {
    action: ProjectStatusAction;
    /** The system status it writes. */
    category: string;
    /** The status row it picks; undefined in a project without rows. */
    statusId?: number;
    /** The row it moves to, for its icon. */
    toBuiltinKey: string | null;
};

/** The row one side of an action names. A computed default names it by built-in key. */
export const actionRow = (
    rows: readonly ProjectStatusDef[],
    statusId: number | null,
    key: string | null
): ProjectStatusDef | undefined =>
    statusId != null
        ? rows.find((r) => r.statusId === statusId)
        : rows.find((r) => key != null && r.builtinKey === key);

/** The actions of the item's current status, in the editor's order: the first is the button. */
export const quickActionsFor = (
    actions: readonly ProjectStatusAction[],
    rows: readonly ProjectStatusDef[],
    status: string | null | undefined,
    customStatusId?: number | null
): QuickAction[] => {
    if (!status) return [];
    const current = resolveStatusRow(rows, status, customStatusId);
    if (rows.length && (!current || current.isArchived)) return [];
    return actions.flatMap((action): QuickAction[] => {
        if (!action.enabled) return [];
        if (!rows.length) {
            if (action.beforeKey !== status || !action.afterKey) return [];
            if (action.afterKey === IN_REVIEW_KEY) return [];
            return [{ action, category: action.afterKey, toBuiltinKey: action.afterKey }];
        }
        const before = actionRow(rows, action.beforeStatusId, action.beforeKey);
        if (before?.statusId !== current?.statusId) return [];
        const after = actionRow(rows, action.afterStatusId, action.afterKey);
        if (!after || after.isArchived) return [];
        return [
            {
                action,
                category: after.category,
                statusId: after.statusId,
                toBuiltinKey: after.builtinKey,
            },
        ];
    });
};

export type ActionWords = {
    startTask: string;
    startMilestone: string;
    completeTask: string;
    completeMilestone: string;
    resumeTask: string;
    resumeMilestone: string;
    markReady: string;
    reopen: string;
};

/** The default title of a pair, for the kind of item looked at. */
export const defaultActionTitle = (
    key: ProjectStatusAction["defaultKey"],
    kind: "task" | "milestone",
    words: ActionWords
): string => {
    const milestone = kind === "milestone";
    switch (key) {
        case "start":
            return milestone ? words.startMilestone : words.startTask;
        case "complete":
            return milestone ? words.completeMilestone : words.completeTask;
        case "resume":
            return milestone ? words.resumeMilestone : words.resumeTask;
        case "mark_ready":
            return words.markReady;
        case "reopen":
            return words.reopen;
        default:
            return "";
    }
};

/** A typed title shows as typed to everyone; a default one in the viewer's language. */
export const actionTitle = (
    action: ProjectStatusAction,
    kind: "task" | "milestone",
    words: ActionWords
): string => action.title ?? defaultActionTitle(action.defaultKey, kind, words);

/** Mirrors `DEFAULT_KEYS` in genos-api's `project_status_actions`: the editor asks which pair
 *  has a default title before it saves one. */
const DEFAULT_KEYS: Record<string, ProjectStatusAction["defaultKey"]> = {
    "Open>WIP": "start",
    [`${IN_REVIEW_KEY}>WIP`]: "start",
    [`Open>${IN_REVIEW_KEY}`]: "mark_ready",
    "WIP>Closed": "complete",
    "Blocked>WIP": "resume",
    "Pending>WIP": "resume",
    "Closed>Open": "reopen",
    "Rejected>Open": "reopen",
};

export const pairDefaultKey = (
    beforeKey: string | null | undefined,
    afterKey: string | null | undefined
): ProjectStatusAction["defaultKey"] =>
    beforeKey && afterKey ? (DEFAULT_KEYS[`${beforeKey}>${afterKey}`] ?? null) : null;

export const MAX_ACTIONS = 30;
export const MAX_ACTION_TITLE = 24;
