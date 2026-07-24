import { useCallback, useEffect, useSyncExternalStore } from "react";

import { useAuth } from "../../context/AuthContext";
import { loadProjectCustomFields } from "../../features/tasks/services/projectCustomFields";
import { ProjectCustomFieldDef } from "../../types/tasks";

/**
 * Shared read-store for per-project custom field DEFINITIONS.
 *
 * Consumers span hosts that share no common ancestor below App
 * (TaskMainBlock in the page preview / UrlLinkModal / create form /
 * chat-side create panel, DraggableTaskTable, TaskTableColumnSettings),
 * so this is a **module-level store** surfaced via
 * `useSyncExternalStore` — the same architecture as
 * `useTaskTableColumnPreferences` — rather than a `useTaskManagement`
 * slot. That keeps definition loads/refreshes out of App-root state
 * (whose writes re-render every keep-alive Home) and gives every
 * consumer one cached fetch per project with in-flight dedupe.
 *
 * Entries are cached per projectId for the session; `refresh()` (used
 * by the manage modal after a mutation) refetches and notifies every
 * subscriber, so the preview section, the table columns and the
 * settings modal all converge without prop plumbing.
 */

export type ProjectCustomFieldsEntry = {
    fields: ProjectCustomFieldDef[];
    canManage: boolean;
    loaded: boolean;
};

const EMPTY_ENTRY: ProjectCustomFieldsEntry = { fields: [], canManage: false, loaded: false };

// projectId → entry. Replaced (not mutated) on every write so
// `getSnapshot` consumers can rely on reference equality per project.
let store = new Map<number, ProjectCustomFieldsEntry>();
const listeners = new Set<() => void>();
const inFlight = new Map<number, Promise<void>>();

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const notify = (): void => {
    listeners.forEach((l) => l());
};

const setEntry = (projectId: number, entry: ProjectCustomFieldsEntry): void => {
    store = new Map(store);
    store.set(projectId, entry);
    notify();
};

const fetchInto = (projectId: number, accessToken: string | null): Promise<void> => {
    const existing = inFlight.get(projectId);
    if (existing) return existing;
    const p = (async () => {
        const payload = await loadProjectCustomFields(projectId, accessToken);
        // Null response (network error / 403) records an EMPTY loaded
        // entry — consumers render no custom fields rather than
        // retry-looping. `refresh` clears the way for a manual retry.
        setEntry(projectId, {
            fields: payload?.fields ?? [],
            canManage: payload?.canManage ?? false,
            loaded: true,
        });
    })().finally(() => {
        inFlight.delete(projectId);
    });
    inFlight.set(projectId, p);
    return p;
};

/** Imperative refresh — used by the manage modal after any mutation so
 *  every subscribed surface (preview rows, table columns, settings
 *  list) picks up the new definitions. */
export const refreshProjectCustomFields = (
    projectId: number,
    accessToken: string | null
): Promise<void> => {
    return fetchInto(projectId, accessToken);
};

export const useProjectCustomFields = (
    projectId: number | null | undefined
): ProjectCustomFieldsEntry & { refresh: () => Promise<void> } => {
    const { accessToken } = useAuth();
    const snapshot = useSyncExternalStore(
        subscribe,
        () => (projectId != null ? (store.get(projectId) ?? EMPTY_ENTRY) : EMPTY_ENTRY),
        () => EMPTY_ENTRY
    );

    // Lazy first load per project. Keyed on projectId only — the store
    // dedupes concurrent mounts via `inFlight`, and a loaded entry is
    // never refetched implicitly (manage-modal mutations call refresh).
    useEffect(() => {
        if (projectId == null) return;
        if (store.get(projectId)?.loaded) return;
        void fetchInto(projectId, accessToken);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId]);

    const refresh = useCallback(async () => {
        if (projectId == null) return;
        await fetchInto(projectId, accessToken);
    }, [projectId, accessToken]);

    return { ...snapshot, refresh };
};

/** Test-only: reset the module store between test cases. */
export const __resetProjectCustomFieldsStore = (): void => {
    store = new Map();
    inFlight.clear();
};
