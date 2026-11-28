import { useCallback, useEffect, useRef, useSyncExternalStore } from "react";

import {
    loadProjectStatusActions,
    ProjectStatusActionsPayload,
} from "../../features/tasks/services/projectStatusActions";
import { ProjectStatusAction } from "../../types/tasks";

/**
 * The read store of each project's quick status actions (MIP-2603), shared by the preview
 * headers and the editor, so a change in the editor reaches the open task at once.
 *
 * Unlike a status label, a button can be wrong in a way that matters (a teammate's edit, an
 * unarchived project, a changed share), so a list older than `STALE_MS` is read again when a
 * header or the editor next shows it, and a failed read is retried then too.
 */

export type ProjectStatusActionsEntry = ProjectStatusActionsPayload & {
    loaded: boolean;
    /** The last read failed; the actions are the ones from before it, if any. */
    failed: boolean;
};

export const STALE_MS = 30_000;

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
const readAt = new Map<number, number>();
/** Counts the reads started and the answers put in: an older read must not land on a newer. */
const versions = new Map<number, number>();

const subscribe = (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
        listeners.delete(listener);
    };
};

const bump = (projectId: number): number => {
    const next = (versions.get(projectId) ?? 0) + 1;
    versions.set(projectId, next);
    return next;
};

const setEntry = (projectId: number, entry: ProjectStatusActionsEntry): void => {
    store = new Map(store);
    store.set(projectId, entry);
    listeners.forEach((l) => l());
};

/** Put a list the server just answered a write with (or the order just dropped) into the store. */
export const setProjectStatusActions = (
    projectId: number,
    data: ProjectStatusActionsPayload
): void => {
    bump(projectId);
    readAt.set(projectId, Date.now());
    setEntry(projectId, { ...data, loaded: true, failed: false });
};

export const refreshProjectStatusActions = (
    projectId: number,
    accessToken: string | null,
    /** After a change elsewhere (a status deleted, the set-up): a read already on its way was
     *  asked before it, so another is made. */
    { afterChange = false }: { afterChange?: boolean } = {}
): Promise<void> => {
    const existing = inFlight.get(projectId);
    if (existing && !afterChange) return existing;
    const mine = bump(projectId);
    const p: Promise<void> = (async () => {
        const payload = await loadProjectStatusActions(projectId, accessToken);
        if (versions.get(projectId) !== mine) return;
        if (payload) setProjectStatusActions(projectId, payload);
        // A failed read keeps what was there.
        else
            setEntry(projectId, {
                ...(store.get(projectId) ?? EMPTY),
                loaded: true,
                failed: true,
            });
    })().finally(() => {
        if (inFlight.get(projectId) === p) inFlight.delete(projectId);
    });
    inFlight.set(projectId, p);
    return p;
};

export const useProjectStatusActions = (
    projectId: number | null | undefined,
    accessToken: string | null,
    /** Whether the client knows the project as archived: a change of it is a reason to read. */
    archived = false
): ProjectStatusActionsEntry => {
    const read = useCallback(
        () => (projectId != null ? (store.get(projectId) ?? EMPTY) : EMPTY),
        [projectId]
    );
    const entry = useSyncExternalStore(subscribe, read, read);
    const wasArchived = useRef(archived);

    useEffect(() => {
        const unarchived = wasArchived.current && !archived;
        wasArchived.current = archived;
        if (projectId == null || !accessToken) return;
        const known = store.get(projectId);
        const stale = Date.now() - (readAt.get(projectId) ?? 0) > STALE_MS;
        if (unarchived || !known?.loaded || known.failed || stale) {
            void refreshProjectStatusActions(projectId, accessToken, { afterChange: unarchived });
        }
    }, [projectId, accessToken, archived]);

    return entry;
};

/** Signed out, or between test cases: nobody else's lists stay. */
export const __resetProjectStatusActionsStore = (): void => {
    store = new Map();
    inFlight.clear();
    readAt.clear();
    // A read still on its way belongs to who was signed in.
    versions.forEach((_, id) => bump(id));
    listeners.forEach((l) => l());
};
