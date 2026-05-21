import { useCallback, useSyncExternalStore } from "react";

/**
 * Per-device user preferences for the task table's column layout —
 * order + visibility. Persisted to localStorage so the customizations
 * survive across sessions on this device. Per-device on purpose:
 * different screens / monitors warrant different layouts.
 *
 * Architecture: a **module-level store** with subscribers, surfaced
 * via `useSyncExternalStore`. Multiple components calling this hook
 * share the same state — so toggling a column in the settings modal
 * immediately re-renders the table. The earlier per-instance
 * `useState` approach had each consumer owning a private copy, which
 * meant cross-component updates only landed after a page reload.
 *
 * Storage shape (versioned, intentionally not migrated on schema
 * changes — bump the version and start fresh):
 *
 *   {
 *     "fields": ["title", "status", "assigneeId", ...],
 *     "visibility": { "pr": true, "createdDate": false, ... }
 *   }
 *
 *   - `fields`      → user-preferred full order for the toggleable
 *                     columns. Empty array means "no user
 *                     customization yet — use default order". Once
 *                     populated, this is the **authoritative full**
 *                     order; the consumer appends any default columns
 *                     missing from the list (handles new columns
 *                     added in code after the user customized).
 *   - `visibility`  → **explicit overrides** per field. A field absent
 *                     from this map uses the column's own `hidden`
 *                     default (so a column like PR can be hidden by
 *                     default in code AND opt-in-able by the user
 *                     without us seeding the persisted state).
 */

export interface TaskTableColumnPreferences {
    fieldOrder: string[];
    visibilityOverrides: Record<string, boolean>;
}

const STORAGE_KEY = "weikiy.taskTable.columnPrefs.v1";

interface SerializedPrefs {
    fields: string[];
    visibility: Record<string, boolean>;
}

const readFromStorage = (): TaskTableColumnPreferences => {
    if (typeof window === "undefined") {
        return { fieldOrder: [], visibilityOverrides: {} };
    }
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (!raw) return { fieldOrder: [], visibilityOverrides: {} };
        const parsed: unknown = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object") {
            return { fieldOrder: [], visibilityOverrides: {} };
        }
        const obj = parsed as Record<string, unknown>;
        const fields = Array.isArray(obj.fields)
            ? obj.fields.filter((f): f is string => typeof f === "string")
            : [];
        const visibility: Record<string, boolean> = {};
        const rawVis = obj.visibility;
        if (rawVis && typeof rawVis === "object") {
            for (const [field, value] of Object.entries(rawVis as Record<string, unknown>)) {
                if (typeof value === "boolean") visibility[field] = value;
            }
        }
        return { fieldOrder: fields, visibilityOverrides: visibility };
    } catch {
        return { fieldOrder: [], visibilityOverrides: {} };
    }
};

const writeToStorage = (state: TaskTableColumnPreferences): void => {
    if (typeof window === "undefined") return;
    try {
        const serialized: SerializedPrefs = {
            fields: state.fieldOrder,
            visibility: state.visibilityOverrides,
        };
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(serialized));
    } catch {
        // Quota / private mode — ignore. The in-memory state still works.
    }
};

// ── Module-level store ───────────────────────────────────────────
// Seeded once from localStorage. Every consumer's `useSyncExternalStore`
// reads through `getSnapshot` and re-renders when `notify()` fires, so
// the modal and the table stay in lockstep.

let storeState: TaskTableColumnPreferences = readFromStorage();
const listeners = new Set<() => void>();

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const getSnapshot = (): TaskTableColumnPreferences => storeState;

const setStoreState = (
    updater: (prev: TaskTableColumnPreferences) => TaskTableColumnPreferences
): void => {
    const next = updater(storeState);
    if (next === storeState) return;
    storeState = next;
    writeToStorage(storeState);
    listeners.forEach((l) => l());
};

interface UseTaskTableColumnPreferencesResult extends TaskTableColumnPreferences {
    /** Flip visibility for one field. Does NOT touch `fieldOrder` — order
     *  is independent and should only change via `setFieldOrder`. */
    setVisibility: (field: string, visible: boolean) => void;
    /** Replace the order list entirely. Consumer is responsible for
     *  computing the full ordered list (e.g. after a drag-and-drop
     *  reorder) and passing it in. */
    setFieldOrder: (next: string[]) => void;
    /** Drop all user customizations — the consumer falls back to its
     *  own defaults. */
    reset: () => void;
}

export const useTaskTableColumnPreferences = (): UseTaskTableColumnPreferencesResult => {
    const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

    const setVisibility = useCallback((field: string, visible: boolean) => {
        setStoreState((prev) => ({
            ...prev,
            visibilityOverrides: { ...prev.visibilityOverrides, [field]: visible },
        }));
    }, []);

    const setFieldOrder = useCallback((next: string[]) => {
        setStoreState((prev) => ({ ...prev, fieldOrder: [...next] }));
    }, []);

    const reset = useCallback(() => {
        setStoreState(() => ({ fieldOrder: [], visibilityOverrides: {} }));
    }, []);

    return {
        fieldOrder: state.fieldOrder,
        visibilityOverrides: state.visibilityOverrides,
        setVisibility,
        setFieldOrder,
        reset,
    };
};
