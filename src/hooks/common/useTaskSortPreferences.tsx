import { createContext, ReactNode, useCallback, useContext, useState } from "react";

/**
 * Shared sort preferences for the two task-list surfaces (sprint board
 * and task table). Provides:
 *
 *   - `sprintBoardSort`: "default" | "dueDate" | "priority". Drives the
 *     toolbar selector in `SprintBoard.tsx` and the underlying per-column
 *     sort helper.
 *   - `tableSort`: { field, direction }. Drives the table's column-click
 *     sort + the matching comparator pipeline.
 *
 * Both are persisted to localStorage and the same hook backs the
 * Settings modal selectors, the SprintBoard toolbar, and the
 * DraggableTaskTable column-click — so changes in any one surface
 * propagate to the others without prop drilling.
 *
 * Pattern matches `useThemePreference` / `useBubbleStylePreference` —
 * Context + Provider mounted near the App root. Consumed via the
 * `useTaskSortPreferences()` hook; when the provider isn't mounted
 * (rare, e.g. a story / isolated test), the hook returns no-op stubs.
 */

// ---- Sprint Board ----
export type SprintBoardSortKey = "default" | "dueDate" | "priority";
const SPRINT_BOARD_STORAGE_KEY = "weikiy.sprintBoard.sortBy";

const isSprintBoardSortKey = (val: unknown): val is SprintBoardSortKey =>
    val === "default" || val === "dueDate" || val === "priority";

// ---- Task Table ----
export type TableSortConfig = {
    field: string;
    direction: "asc" | "desc";
};

const TABLE_STORAGE_KEY = "weikiy.taskTable.sort";

const DEFAULT_TABLE_SORT: TableSortConfig = { field: "priority", direction: "desc" };

const isTableSort = (val: unknown): val is TableSortConfig => {
    if (typeof val !== "object" || val === null) return false;
    const obj = val as Record<string, unknown>;
    return typeof obj.field === "string" && (obj.direction === "asc" || obj.direction === "desc");
};

// "Named" sort presets surfaced in the Settings modal. The table still
// allows column-header clicks to sort by *any* field — when the
// resulting `{field, direction}` doesn't match any preset, Settings
// shows "Custom" (greyed out, non-selectable).
export type TableSortPreset =
    | "priorityDesc"
    | "dueDateAsc"
    | "statusAsc"
    | "updatedAtDesc"
    | "createdDateDesc"
    | "idAsc"
    | "custom";

const TABLE_PRESETS: Record<Exclude<TableSortPreset, "custom">, TableSortConfig> = {
    priorityDesc: { field: "priority", direction: "desc" },
    dueDateAsc: { field: "dueDate", direction: "asc" },
    statusAsc: { field: "status", direction: "asc" },
    updatedAtDesc: { field: "updatedAt", direction: "desc" },
    createdDateDesc: { field: "createdDate", direction: "desc" },
    idAsc: { field: "id", direction: "asc" },
};

export const matchTablePreset = (config: TableSortConfig): TableSortPreset => {
    for (const [key, value] of Object.entries(TABLE_PRESETS)) {
        if (value.field === config.field && value.direction === config.direction) {
            return key as TableSortPreset;
        }
    }
    return "custom";
};

export const resolveTablePreset = (preset: TableSortPreset): TableSortConfig | null => {
    if (preset === "custom") return null;
    return TABLE_PRESETS[preset] ?? null;
};

// ---- localStorage IO (defensive: SSR-safe + sandbox-safe) ----
const readSprintBoardSort = (): SprintBoardSortKey => {
    if (typeof window === "undefined") return "default";
    try {
        const v = window.localStorage.getItem(SPRINT_BOARD_STORAGE_KEY);
        if (isSprintBoardSortKey(v)) return v;
    } catch {
        // localStorage unavailable (sandboxed iframe etc.) — fall through.
    }
    return "default";
};

const readTableSort = (): TableSortConfig => {
    if (typeof window === "undefined") return DEFAULT_TABLE_SORT;
    try {
        const raw = window.localStorage.getItem(TABLE_STORAGE_KEY);
        if (!raw) return DEFAULT_TABLE_SORT;
        const parsed = JSON.parse(raw);
        if (isTableSort(parsed)) return parsed;
    } catch {
        // Either localStorage threw or the persisted blob is corrupted.
    }
    return DEFAULT_TABLE_SORT;
};

interface TaskSortPreferencesContextValue {
    sprintBoardSort: SprintBoardSortKey;
    setSprintBoardSort: (key: SprintBoardSortKey) => void;
    tableSort: TableSortConfig;
    setTableSort: (sort: TableSortConfig) => void;
}

const TaskSortPreferencesContext = createContext<TaskSortPreferencesContextValue | null>(null);

export const TaskSortPreferencesProvider = ({ children }: { children: ReactNode }) => {
    const [sprintBoardSort, setSprintBoardSortState] =
        useState<SprintBoardSortKey>(readSprintBoardSort);
    const [tableSort, setTableSortState] = useState<TableSortConfig>(readTableSort);

    const setSprintBoardSort = useCallback((key: SprintBoardSortKey) => {
        setSprintBoardSortState(key);
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(SPRINT_BOARD_STORAGE_KEY, key);
            } catch {
                // ignore
            }
        }
    }, []);

    const setTableSort = useCallback((sort: TableSortConfig) => {
        setTableSortState(sort);
        if (typeof window !== "undefined") {
            try {
                window.localStorage.setItem(TABLE_STORAGE_KEY, JSON.stringify(sort));
            } catch {
                // ignore
            }
        }
    }, []);

    return (
        <TaskSortPreferencesContext.Provider
            value={{ sprintBoardSort, setSprintBoardSort, tableSort, setTableSort }}
        >
            {children}
        </TaskSortPreferencesContext.Provider>
    );
};

export const useTaskSortPreferences = (): TaskSortPreferencesContextValue => {
    const ctx = useContext(TaskSortPreferencesContext);
    if (!ctx) {
        // Provider not mounted (or consumed outside the tree). Return a
        // no-op stub so callers don't crash; the real provider will take
        // over once the App tree mounts.
        return {
            sprintBoardSort: "default",
            setSprintBoardSort: () => {},
            tableSort: DEFAULT_TABLE_SORT,
            setTableSort: () => {},
        };
    }
    return ctx;
};
