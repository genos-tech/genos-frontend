import { useCallback, useEffect, useSyncExternalStore } from "react";

import {
    loadProjectStatuses,
    ProjectStatusesPayload,
} from "../../features/tasks/services/projectStatuses";
import { ProjectStatusDef } from "../../types/tasks";

/**
 * The read store of each project's statuses (MIP-2493), shared by every status chip, picker
 * and the editor: the same module-level shape as `useProjectCustomFields`, so a change in the
 * editor reaches every surface and App-root state is not touched.
 *
 * The token comes from `AuthContext` through `setProjectStatusesToken`, not from a hook: a
 * status chip is drawn in many places, some with no provider above (and without a token the
 * chip simply shows the system status).
 *
 * One request per project per session, with in-flight dedupe. A chip that meets a status id
 * the list does not hold (a teammate added one) reads the list again, once per id.
 */

export type ProjectStatusesEntry = ProjectStatusesPayload & {
    loaded: boolean;
    failed: boolean;
};

const NO_STATUSES: ProjectStatusDef[] = [];
const EMPTY: ProjectStatusesEntry = {
    statuses: NO_STATUSES,
    canManage: false,
    loaded: false,
    failed: false,
};

let store = new Map<number, ProjectStatusesEntry>();
const listeners = new Set<() => void>();
const inFlight = new Map<number, Promise<void>>();
const askedFor = new Set<string>();
let token: string | null = null;

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const setEntry = (projectId: number, entry: ProjectStatusesEntry): void => {
    store = new Map(store);
    store.set(projectId, entry);
    listeners.forEach((l) => l());
};

export const setProjectStatusesToken = (next: string | null): void => {
    if (next === token) return;
    // Another person's lists are not this person's.
    if (!next) store = new Map();
    token = next;
    listeners.forEach((l) => l());
};

const readToken = () => token;

/** Put a list the server just answered with into the store. */
export const setProjectStatuses = (projectId: number, data: ProjectStatusesPayload): void =>
    setEntry(projectId, { ...data, loaded: true, failed: false });

export const refreshProjectStatuses = (
    projectId: number,
    accessToken: string | null
): Promise<void> => {
    const existing = inFlight.get(projectId);
    if (existing) return existing;
    const p = (async () => {
        const payload = await loadProjectStatuses(projectId, accessToken);
        if (payload) setProjectStatuses(projectId, payload);
        // A failed read keeps what was there; a first one is recorded, so no retry loop.
        else {
            const previous = store.get(projectId);
            if (!previous || !previous.loaded) {
                setEntry(projectId, { ...EMPTY, loaded: true, failed: true });
            }
        }
    })().finally(() => {
        inFlight.delete(projectId);
    });
    inFlight.set(projectId, p);
    return p;
};

export const useProjectStatuses = (
    projectId: number | null | undefined,
    /** A task's status id: when the loaded list lacks it, the list is read again. */
    expectedId?: number | null
): ProjectStatusesEntry => {
    const accessToken = useSyncExternalStore(subscribe, readToken, readToken);
    const read = useCallback(
        () => (projectId != null ? (store.get(projectId) ?? EMPTY) : EMPTY),
        [projectId]
    );
    const entry = useSyncExternalStore(subscribe, read, read);

    useEffect(() => {
        if (projectId == null || !accessToken) return;
        if (!store.get(projectId)?.loaded) void refreshProjectStatuses(projectId, accessToken);
    }, [projectId, accessToken]);

    useEffect(() => {
        if (projectId == null || expectedId == null || !accessToken || !entry.loaded) return;
        if (entry.statuses.some((s) => s.statusId === expectedId)) return;
        const key = `${projectId}:${expectedId}`;
        if (askedFor.has(key)) return;
        askedFor.add(key);
        void refreshProjectStatuses(projectId, accessToken);
    }, [projectId, expectedId, accessToken, entry]);

    return entry;
};

/** Test-only: reset the module store between test cases. */
export const __resetProjectStatusesStore = (): void => {
    store = new Map();
    inFlight.clear();
    askedFor.clear();
    token = null;
};
