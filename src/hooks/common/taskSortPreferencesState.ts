import { createContext, useContext } from "react";

import { isSortDirection, isSortField, SortTier } from "../../features/tasks/utils/sortTask";

/**
 * Shared sort preferences for the two task-list surfaces (sprint board
 * and task table). Each surface stores up to **2 sort tiers**
 * (`primary` + optional `secondary`); each tier is a `{field, direction}`
 * pair. The comparator (`buildComparator` in
 * `features/tasks/utils/sortTask.ts`) walks the array in order and
 * tie-breaks on id at the end.
 *
 * Empty array = no sort applied (preserve filter pipeline order). This
 * is the default for the sprint board (matches the old "default"
 * sentinel). The table defaults to one tier (priority desc) so the
 * "Critical work surfaces first" behaviour from before this refactor
 * stays intact.
 *
 * Both arrays are persisted to localStorage under `*.v2` keys; the old
 * single-key shape from the previous version is intentionally not
 * migrated — the schema change is large enough that resetting to
 * sensible defaults is cleaner than guessing at a translation.
 *
 * The table additionally has a **temporary override** (`tableSortOverride`)
 * set by clicking a column header. It lives only in memory here (never
 * persisted, gone on reload), is stamped with the project it was made in so it
 * ends when the user switches project, and is cleared whenever the Task sort
 * modal saves (`setTableSortTiers`). The saved `tableSortTiers` is never
 * touched by a header click. It sits in the provider, not table state,
 * because the table unmounts while hidden (e.g. creating a task).
 *
 * Pattern matches `useThemePreference` / `useBubbleStylePreference` —
 * Context + Provider mounted near the App root. Consumed via the
 * `useTaskSortPreferences()` hook; when the provider isn't mounted
 * (rare, e.g. a story / isolated test), the hook returns no-op stubs.
 */

export type { SortTier };

export const SPRINT_BOARD_STORAGE_KEY = "genos.sprintBoard.sortTiers.v2";
export const TABLE_STORAGE_KEY = "genos.taskTable.sortTiers.v2";

// Defaults preserve the previous behaviour exactly:
//   - Sprint board: "default" → no sort → []
//   - Task table:   { field: "priority", direction: "desc" } → 1 tier
export const DEFAULT_SPRINT_BOARD_TIERS: SortTier[] = [];
export const DEFAULT_TABLE_TIERS: SortTier[] = [{ field: "priority", direction: "desc" }];

const MAX_TIERS = 2;

const isSortTier = (val: unknown): val is SortTier => {
    if (typeof val !== "object" || val === null) return false;
    const obj = val as Record<string, unknown>;
    return isSortField(obj.field) && isSortDirection(obj.direction);
};

// Validate + clamp incoming tier arrays — defends both the localStorage
// read path (corrupted blob) and the public setter (callers that
// accidentally pass an unbounded array).
export const sanitizeTiers = (tiers: unknown): SortTier[] => {
    if (!Array.isArray(tiers)) return [];
    const sanitized: SortTier[] = [];
    for (const tier of tiers) {
        if (!isSortTier(tier)) continue;
        // Drop duplicates on field — having "priority asc" twice would
        // be useless and confusing.
        if (sanitized.some((t) => t.field === tier.field)) continue;
        sanitized.push({ field: tier.field, direction: tier.direction });
        if (sanitized.length >= MAX_TIERS) break;
    }
    return sanitized;
};

export const readTiers = (storageKey: string, fallback: SortTier[]): SortTier[] => {
    if (typeof window === "undefined") return fallback;
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) return fallback;
        const parsed = JSON.parse(raw);
        const sanitized = sanitizeTiers(parsed);
        // Treat "empty after sanitization" as "blob is fine, user wants
        // zero tiers" only for the sprint board. For the table, fall
        // back to default so a corrupted blob doesn't silently switch
        // the table into an unsorted state on every reload.
        if (sanitized.length === 0 && fallback.length > 0) {
            // Distinguish "valid empty array (user-set)" from "broken blob".
            if (Array.isArray(parsed) && parsed.length === 0) return sanitized;
            return fallback;
        }
        return sanitized;
    } catch {
        // Either localStorage threw or the persisted blob is corrupted.
    }
    return fallback;
};

interface TaskSortPreferencesContextValue {
    sprintBoardSortTiers: SortTier[];
    setSprintBoardSortTiers: (tiers: SortTier[]) => void;
    tableSortTiers: SortTier[];
    /** Saved table sort (what the Task sort modal edits). */
    setTableSortTiers: (tiers: SortTier[]) => void;
    /** Temporary header-click sort, or null. See `tableSortOverrideFor`. */
    tableSortOverride: TableSortOverride | null;
    /** Set (tiers + the project it applies to) or clear (null) the override. */
    setTableSortOverride: (tiers: SortTier[] | null, projectId: number | null) => void;
}

/** In-memory header-click sort, valid only for the project it was made in. */
export type TableSortOverride = { tiers: SortTier[]; projectId: number | null };

/** The override's tiers if it applies to `projectId`, else null. */
export const tableSortOverrideFor = (
    override: TableSortOverride | null,
    projectId: number | null
): SortTier[] | null => (override && override.projectId === projectId ? override.tiers : null);

export const TaskSortPreferencesContext = createContext<TaskSortPreferencesContextValue | null>(
    null
);

export const useTaskSortPreferences = (): TaskSortPreferencesContextValue => {
    const ctx = useContext(TaskSortPreferencesContext);
    if (!ctx) {
        // Provider not mounted (or consumed outside the tree). Return a
        // no-op stub so callers don't crash; the real provider will take
        // over once the App tree mounts.
        return {
            sprintBoardSortTiers: DEFAULT_SPRINT_BOARD_TIERS,
            setSprintBoardSortTiers: () => {},
            tableSortTiers: DEFAULT_TABLE_TIERS,
            setTableSortTiers: () => {},
            tableSortOverride: null,
            setTableSortOverride: () => {},
        };
    }
    return ctx;
};
