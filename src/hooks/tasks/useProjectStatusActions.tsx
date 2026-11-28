import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
    loadProjectStatusActions,
    ProjectStatusActionsPayload,
} from "../../features/tasks/services/projectStatusActions";
import { ProjectStatusAction } from "../../types/tasks";

/**
 * The read store of each project's quick status actions (MIP-2603), shared by the preview
 * headers and the editor, so a change in the editor reaches the open task at once. The same
 * module-level shape as `useProjectStatuses`: one request per project per session, and the
 * editor reads again when it opens.
 */

export type ProjectStatusActionsEntry = ProjectStatusActionsPayload & {
    loaded: boolean;
    failed: boolean;
};

const NO_ACTIONS: ProjectStatusAction[] = [];
const EMPTY: ProjectStatusActionsEntry = {
    actions: NO_ACTIONS,
    canManage: false,
    canAct: false,
    loaded: false,
    failed: false,
};

let store = new Map<number, ProjectStatusActionsEntry>();
const listeners = new Set<() => void>();
const inFlight = new Map<number, Promise<void>>();

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const setEntry = (projectId: number, entry: ProjectStatusActionsEntry): void => {
    store = new Map(store);
    store.set(projectId, entry);
    listeners.forEach((l) => l());
};

/** Put a list the server just answered with into the store. */
export const setProjectStatusActions = (
    projectId: number,
    data: ProjectStatusActionsPayload
): void => setEntry(projectId, { ...data, loaded: true, failed: false });

export const refreshProjectStatusActions = (
    projectId: number,
    accessToken: string | null
): Promise<void> => {
    const existing = inFlight.get(projectId);
    if (existing) return existing;
    const p = (async () => {
        const payload = await loadProjectStatusActions(projectId, accessToken);
        if (payload) setProjectStatusActions(projectId, payload);
        // A failed read keeps what was there; a first one is recorded, so no retry loop.
        else if (!store.get(projectId)?.loaded) {
            setEntry(projectId, { ...EMPTY, loaded: true, failed: true });
        }
    })().finally(() => {
        inFlight.delete(projectId);
    });
    inFlight.set(projectId, p);
    return p;
};

export const useProjectStatusActions = (
    projectId: number | null | undefined,
    accessToken: string | null
): ProjectStatusActionsEntry => {
    const read = useCallback(
        () => (projectId != null ? (store.get(projectId) ?? EMPTY) : EMPTY),
        [projectId]
    );
    const entry = useSyncExternalStore(subscribe, read, read);

    useEffect(() => {
        if (projectId == null || !accessToken) return;
        if (!store.get(projectId)?.loaded) {
            void refreshProjectStatusActions(projectId, accessToken);
        }
    }, [projectId, accessToken]);

    return entry;
};

/** Signed out, or between test cases: nobody else's lists stay. */
export const __resetProjectStatusActionsStore = (): void => {
    store = new Map();
    inFlight.clear();
    listeners.forEach((l) => l());
};
