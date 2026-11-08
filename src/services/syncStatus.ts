import { useSyncExternalStore } from "react";

/**
 * "Did the background sync work?" for the whole app (MIP-1298).
 *
 * The chat list, inbox, task table and sidebars read IndexedDB and are refilled
 * once, for everyone, by `refreshAllData` (boot, wake, online) and the project
 * list load. Those loaders used to swallow a failure, so a cold cache plus a
 * failed first refresh opened a shell saying "No chats yet / No project
 * selected": a claim about the user's data that nothing had checked, and a
 * per-surface Retry has nothing of its own to re-run.
 *
 * This store is the one place that failure lands:
 *
 *   - the loaders report `report(scope, ok)`; `refreshAllData` brackets a run
 *     with `begin()` / `end()`;
 *   - `SyncStatusBanner` reads `failed` (quiet, Retry);
 *   - an EMPTY surface asks `useSyncFailed(scope)` and shows `ErrorState`
 *     instead of "No X yet". A surface with rows ignores it: a warm cache keeps
 *     its data (MIP-973).
 *
 * `retry` is registered by `App`, which owns the arguments the loaders need.
 */
export type SyncScope = "channels" | "inbox" | "activity" | "members" | "tasks" | "projects";

export type SyncStatusSnapshot = {
    /** A `refreshAllData` run is in flight. */
    syncing: boolean;
    /** Scopes whose latest load failed, in the order they were reported. */
    failed: readonly SyncScope[];
    /** Bumped each time `failed` goes from empty to non-empty, so a dismissed
     *  banner stays dismissed for that outage and returns for the next one. */
    episode: number;
};

const EMPTY: readonly SyncScope[] = [];

let snapshot: SyncStatusSnapshot = { syncing: false, failed: EMPTY, episode: 0 };
let runs = 0;
let retryFn: (() => void | Promise<void>) | null = null;
const listeners = new Set<() => void>();

const set = (next: SyncStatusSnapshot) => {
    snapshot = next;
    listeners.forEach((l) => l());
};

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

export const syncStatus = {
    getSnapshot: (): SyncStatusSnapshot => snapshot,

    /** A run starts. Runs may overlap (boot + wake): `syncing` holds until the last ends. */
    begin: () => {
        runs += 1;
        if (!snapshot.syncing) set({ ...snapshot, syncing: true });
    },

    end: () => {
        runs = Math.max(0, runs - 1);
        if (runs === 0 && snapshot.syncing) set({ ...snapshot, syncing: false });
    },

    /** The latest load of `scope` worked (`ok`) or failed. */
    report: (scope: SyncScope, ok: boolean) => {
        const has = snapshot.failed.includes(scope);
        if (ok === !has) return;
        const failed = ok
            ? snapshot.failed.filter((s) => s !== scope)
            : [...snapshot.failed, scope];
        set({
            ...snapshot,
            failed: failed.length === 0 ? EMPTY : failed,
            episode:
                snapshot.failed.length === 0 && failed.length > 0
                    ? snapshot.episode + 1
                    : snapshot.episode,
        });
    },

    setRetry: (fn: (() => void | Promise<void>) | null) => {
        retryFn = fn;
    },

    /** Re-run the sync. A no-op while one is already running or nothing is registered. */
    retry: () => {
        if (snapshot.syncing || !retryFn) return;
        void retryFn();
    },

    /** Test helper. */
    __reset: () => {
        runs = 0;
        retryFn = null;
        snapshot = { syncing: false, failed: EMPTY, episode: 0 };
        listeners.forEach((l) => l());
    },
};

export const useSyncStatus = (): SyncStatusSnapshot =>
    useSyncExternalStore(subscribe, syncStatus.getSnapshot, syncStatus.getSnapshot);

/**
 * What an EMPTY surface needs to tell "could not load" from "nothing here":
 * `failed` (a sync of one of these scopes failed and has not recovered),
 * `retrying` (it failed and a re-run is in flight, so show the skeleton, not a
 * stale error) and `retry`. Feed them to `DataState`; a surface with rows
 * passes `hasData` and ignores all of it.
 */
export const useSyncFailure = (...scopes: SyncScope[]) => {
    const { failed, syncing } = useSyncStatus();
    const hasFailed = scopes.some((s) => failed.includes(s));
    return { failed: hasFailed, retrying: hasFailed && syncing, retry: syncStatus.retry };
};
