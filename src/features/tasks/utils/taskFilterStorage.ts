import { FilterProps } from "../types/TaskTableTypes";

/**
 * Session persistence for the task-table / sprint-board filter bar.
 *
 * The filter selection used to live only in `TaskFilterMenu`'s local
 * state, and `TaskHomeLayout` mounts the table and the board
 * conditionally — switching to the dashboard unmounts whichever was
 * showing — so every trip away from the table dropped the filter back to
 * its defaults.
 *
 * Deliberately local-only (no backend): this is a view preference, and
 * localStorage additionally survives a reload, which lifting the state
 * into a parent would not.
 *
 * What is stored is IDENTITY, never the `FilterProps` objects
 * themselves. Those carry `filterModel` predicates and palette colors —
 * persisting them would pin a stale copy of logic that ships with the
 * app. Storing labels and rehydrating against the live predefined lists
 * means a filter whose definition changed picks up the new one, and a
 * label that no longer exists (a deleted project tag, or a tag from a
 * different project) is simply dropped.
 */

export type StoredTaskFilters = {
    /** Labels, resolved back to `FilterProps` via `rehydrateFilters`. */
    status: string[];
    tags: string[];
    priorities: string[];
    effortLevels: string[];
    /** `"all" | "none" | <milestoneId>` */
    milestoneKeys: (string | number)[];
    /** `"all" | "none" | <sprintId>` */
    sprintKeys: (string | number)[];
    /** `"all" | "none" | <userId>` */
    memberKeys: string[];
};

/**
 * Storage key for one filter bar, or `undefined` to disable persistence.
 *
 * Scoped by SURFACE because the board hides the status filter entirely
 * and pins it to "All" — restoring the table's status selection there
 * would apply a filter the user can't see or clear.
 *
 * Scoped by PROJECT because filters are per-project in practice: tags
 * and milestones only exist within one project, and "show me only my
 * blocked tasks" is a statement about the project you're looking at, not
 * a global mode. Each project keeps its own selection.
 *
 * Returns `undefined` when no project is resolved yet, which switches
 * persistence off rather than writing under a placeholder key that a
 * real project would later inherit.
 */
export const taskFilterStorageKey = (
    surface: "table" | "board",
    projectId: number | string | null | undefined
): string | undefined =>
    projectId == null || projectId === "" ? undefined : `taskFilters:${surface}:${projectId}`;

const isStringArray = (v: unknown): v is string[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string");

// Milestone and sprint keys are `"all" | "none" | <numeric id>`, so unlike
// the label dimensions they legitimately hold numbers as well as strings.
const isKeyArray = (v: unknown): v is (string | number)[] =>
    Array.isArray(v) && v.every((x) => typeof x === "string" || typeof x === "number");

export const readStoredFilters = (key: string): Partial<StoredTaskFilters> | null => {
    try {
        const raw = localStorage.getItem(key);
        if (!raw) return null;
        const parsed: unknown = JSON.parse(raw);
        if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) return null;
        const o = parsed as Record<string, unknown>;
        // Per-field shape guard: a half-corrupt blob contributes the
        // fields it does have rather than dropping the whole selection.
        return {
            ...(isStringArray(o.status) ? { status: o.status } : {}),
            ...(isStringArray(o.tags) ? { tags: o.tags } : {}),
            ...(isStringArray(o.priorities) ? { priorities: o.priorities } : {}),
            ...(isStringArray(o.effortLevels) ? { effortLevels: o.effortLevels } : {}),
            ...(isKeyArray(o.milestoneKeys) ? { milestoneKeys: o.milestoneKeys } : {}),
            ...(isKeyArray(o.sprintKeys) ? { sprintKeys: o.sprintKeys } : {}),
            ...(isStringArray(o.memberKeys) ? { memberKeys: o.memberKeys } : {}),
        };
    } catch {
        return null;
    }
};

export const writeStoredFilters = (key: string, value: StoredTaskFilters): void => {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // Quota / private-mode failures are not worth breaking filtering
        // over — the selection just doesn't outlive this mount.
    }
};

export const clearStoredFilters = (key: string): void => {
    try {
        localStorage.removeItem(key);
    } catch {
        // See above.
    }
};

/**
 * Resolve stored labels back to live `FilterProps`, dropping any label
 * that no longer exists in `available`.
 *
 * Returns `fallback` when nothing survives, so a stale or empty stored
 * selection can never leave the bar with zero filters selected (which
 * the menu treats as an invalid state and the table would render as an
 * empty list).
 */
export const rehydrateFilters = (
    storedLabels: string[] | undefined,
    available: FilterProps[],
    fallback: FilterProps[]
): FilterProps[] => {
    if (!storedLabels || storedLabels.length === 0) return fallback;
    const byLabel = new Map(available.map((f) => [f.label, f]));
    const resolved = storedLabels
        .map((label) => byLabel.get(label))
        .filter((f): f is FilterProps => f !== undefined);
    return resolved.length > 0 ? resolved : fallback;
};

/**
 * Milestone and sprint keys are `"all" | "none" | <numeric id>`; a
 * numeric-looking string is coerced back to a number, since JSON
 * round-trips object keys and hand-edited values as strings.
 *
 * Ids are NOT validated against the current project here. The milestone,
 * sprint and member filters each run a prune effect that drops a selected
 * id once the live set loads without it (soft-deleted milestone, deleted
 * sprint, member who left the team) and falls back to "All" — so a stored
 * id from another project takes exactly the path a stale id already takes,
 * and there's no second validation to keep in sync.
 */
export const rehydrateKeys = (
    stored: (string | number)[] | undefined
): (string | number)[] | null => {
    if (!stored || stored.length === 0) return null;
    const resolved = stored.map((k) => {
        if (typeof k === "number") return k;
        // "all" / "none" / "__all__" / "__none__" pass through as-is;
        // a digit string is a milestone id that lost its type to JSON.
        return /^\d+$/.test(k) ? Number(k) : k;
    });
    return resolved.length > 0 ? resolved : null;
};
