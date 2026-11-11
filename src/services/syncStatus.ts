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
export type NoteListScope = "favorites" | "recents" | "teamFolders";

/**
 * What a load belongs to. Most scopes are one list for the whole app; two are
 * KEYED, because one success must never clear another's failure (the bug the
 * old single `tasks` scope had):
 *
 *   - `tasks:<projectId>`: the rows of ONE project. A failed prefetch of project
 *     B does not mark project A's table, and a success for B does not clear A's
 *     failure. A project that stops existing for this user must not fail
 *     forever: see `retain` / `forget` (MIP-1323).
 *   - `notes:<list>`: the notes sidebar's Favorites, Recents and Team folders
 *     (`/note/*` reads that are not part of `refreshAllData`).
 *   - `flags`: the completed ("past") flags read.
 */
export type SyncScope =
    | "channels"
    | "inbox"
    | "activity"
    | "members"
    | "projects"
    | "flags"
    | `tasks:${number}`
    | `notes:${NoteListScope}`;

export const tasksScope = (projectId: number): SyncScope => `tasks:${projectId}`;

/** Scopes that are part of the boot set: a failure there raises the app-wide banner
 *  and keeps a cold team from being marked hydrated. The on-demand ones (notes, flags)
 *  show their own error where they are, and neither raise the banner nor block that. */
const isBootScope = (scope: SyncScope) => !scope.startsWith("notes:") && scope !== "flags";

export type SyncStatusSnapshot = {
    /** A `refreshAllData` run is in flight. */
    syncing: boolean;
    /** Scopes whose latest load failed, in the order they were reported. */
    failed: readonly SyncScope[];
    /** Bumped each time `failed` goes from empty to non-empty, so a dismissed
     *  banner stays dismissed for that outage and returns for the next one. */
    episode: number;
    /** Scopes with a load in flight (`track`). */
    inFlight: readonly SyncScope[];
    /** Scopes that have answered at least once since the last `reset`. A
     *  surface with nothing to show says "loading" until its scope has: an
     *  empty cache before the first answer is "not read yet", not "empty". */
    answered: readonly SyncScope[];
};

const EMPTY: readonly SyncScope[] = [];

let snapshot: SyncStatusSnapshot = {
    syncing: false,
    failed: EMPTY,
    episode: 0,
    inFlight: EMPTY,
    answered: EMPTY,
};
let runs = 0;
let retryFn: (() => void | Promise<void>) | null = null;
const listeners = new Set<() => void>();

const set = (next: SyncStatusSnapshot) => {
    snapshot = next;
    listeners.forEach((l) => l());
};

// Loads in flight per scope (a count: the notes lists and the flags read are not
// deduplicated, so two can overlap and the first to settle must not clear the other's
// mark) with their ceiling timers. `reset` and `forget` drop them, and bump an epoch so
// a load that settles (or hits its ceiling) afterwards touches nothing: the scope it
// was about no longer exists, or belongs to the team that was switched away from.
type Loads = { count: number; timers: Set<ReturnType<typeof setTimeout>> };
const loads = new Map<SyncScope, Loads>();
let epoch = 0;
const scopeEpoch = new Map<SyncScope, number>();

const dropLoads = (scope: SyncScope) => {
    const entry = loads.get(scope);
    if (entry) entry.timers.forEach((t) => clearTimeout(t));
    loads.delete(scope);
    scopeEpoch.set(scope, (scopeEpoch.get(scope) ?? 0) + 1);
};

const setInFlight = (scope: SyncScope, on: boolean) => {
    if (snapshot.inFlight.includes(scope) === on) return;
    const inFlight = on
        ? [...snapshot.inFlight, scope]
        : snapshot.inFlight.filter((s) => s !== scope);
    set({ ...snapshot, inFlight: inFlight.length === 0 ? EMPTY : inFlight });
};

/** `authApi` has no request timeout; a load that has not answered by now stops
 *  holding a skeleton up and is shown as failed (Retry). */
const LOAD_CEILING_MS = 20_000;

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
        const answered = ok && !snapshot.answered.includes(scope);
        if (ok === !has && !answered) return;
        const failed =
            ok === !has
                ? snapshot.failed
                : ok
                  ? snapshot.failed.filter((s) => s !== scope)
                  : [...snapshot.failed, scope];
        set({
            ...snapshot,
            failed: failed.length === 0 ? EMPTY : failed,
            answered: answered ? [...snapshot.answered, scope] : snapshot.answered,
            // A new outage of the BANNER's scopes (the on-demand notes / flags reads show
            // where they are, not in the app-wide banner).
            episode:
                !snapshot.failed.some(isBootScope) && failed.some(isBootScope)
                    ? snapshot.episode + 1
                    : snapshot.episode,
        });
    },

    /**
     * A load of `scope` is in flight until `promise` settles, which also reports
     * the outcome (`report`). Returns `promise` untouched, so the caller's own
     * handling of a rejection stays as it was. `gone(err)` says a rejection is not
     * a failure to sync but "this scope no longer exists" (a project the user
     * lost): the scope is then `forget`-ed instead of marked failed.
     *
     * A request that never settles must not hold a skeleton up forever:
     * after `ceilingMs` the scope is marked failed (a late answer still clears it).
     */
    track: <T>(
        scope: SyncScope,
        promise: Promise<T>,
        options?: { gone?: (err: unknown) => boolean; ceilingMs?: number }
    ): Promise<T> => {
        const myEpoch = epoch;
        const myScopeEpoch = scopeEpoch.get(scope) ?? 0;
        const live = () => epoch === myEpoch && (scopeEpoch.get(scope) ?? 0) === myScopeEpoch;
        const entry: Loads = loads.get(scope) ?? { count: 0, timers: new Set() };
        loads.set(scope, entry);
        entry.count += 1;
        setInFlight(scope, true);
        const timer = setTimeout(() => {
            entry.timers.delete(timer);
            if (!live()) return;
            setInFlight(scope, false);
            syncStatus.report(scope, false);
        }, options?.ceilingMs ?? LOAD_CEILING_MS);
        entry.timers.add(timer);
        const settle = () => {
            clearTimeout(timer);
            entry.timers.delete(timer);
            entry.count = Math.max(0, entry.count - 1);
            if (live() && entry.count === 0) setInFlight(scope, false);
            return live();
        };
        promise.then(
            () => {
                if (settle()) syncStatus.report(scope, true);
            },
            (err: unknown) => {
                if (!settle()) return;
                if (options?.gone?.(err)) syncStatus.forget(scope);
                else syncStatus.report(scope, false);
            }
        );
        return promise;
    },

    /** The scope stopped existing (a project the user left or lost): drop
     *  everything known about it, so a failure that can never be retried
     *  into success does not hold the banner up. */
    forget: (scope: SyncScope) => {
        dropLoads(scope);
        if (
            !snapshot.failed.includes(scope) &&
            !snapshot.inFlight.includes(scope) &&
            !snapshot.answered.includes(scope)
        )
            return;
        const failed = snapshot.failed.filter((s) => s !== scope);
        set({
            ...snapshot,
            failed: failed.length === 0 ? EMPTY : failed,
            inFlight: snapshot.inFlight.filter((s) => s !== scope),
            answered: snapshot.answered.filter((s) => s !== scope),
        });
    },

    /** The project list just loaded: a FAILURE of a `tasks:<id>` whose project is not in
     *  it (deleted, left, lost access) is dropped, so it cannot hold the banner up for
     *  good. Only failures: a project that was just created or joined may be missing
     *  from a list that was read a moment earlier, and its load in flight stays. */
    retainProjects: (projectIds: readonly number[]) => {
        const keep = new Set(projectIds.map((id) => tasksScope(id)));
        const failed = snapshot.failed.filter((s) => !s.startsWith("tasks:") || keep.has(s));
        if (failed.length !== snapshot.failed.length) {
            set({ ...snapshot, failed: failed.length === 0 ? EMPTY : failed });
        }
    },

    /** Every failed project, so Retry can reload each one (not only the open one). */
    failedProjectIds: (): number[] =>
        snapshot.failed
            .filter((s) => s.startsWith("tasks:"))
            .map((s) => Number(s.slice("tasks:".length))),

    /** A boot-set scope failed (not the on-demand ones: notes, flags). */
    bootFailed: () => snapshot.failed.some(isBootScope),

    setRetry: (fn: (() => void | Promise<void>) | null) => {
        retryFn = fn;
    },

    /** Re-run the sync. A no-op while one is already running (the banner and the
     *  empty states show that run as "syncing") or nothing is registered. */
    retry: () => {
        if (snapshot.syncing || !retryFn) return;
        // The loaders report their own failures; a rejection here must not become
        // an unhandled one.
        Promise.resolve(retryFn()).catch((e) => console.error("[syncStatus] retry failed", e));
    },

    /** Forget what failed: the cache it was about was wiped (team switch). */
    reset: () => {
        epoch += 1;
        loads.forEach((entry) => entry.timers.forEach((t) => clearTimeout(t)));
        loads.clear();
        if (
            snapshot.failed.length > 0 ||
            snapshot.answered.length > 0 ||
            snapshot.inFlight.length > 0
        ) {
            set({ ...snapshot, failed: EMPTY, answered: EMPTY, inFlight: EMPTY });
        }
    },

    /** Test helper. */
    __reset: () => {
        epoch += 1;
        loads.forEach((entry) => entry.timers.forEach((t) => clearTimeout(t)));
        loads.clear();
        runs = 0;
        retryFn = null;
        snapshot = { syncing: false, failed: EMPTY, episode: 0, inFlight: EMPTY, answered: EMPTY };
        listeners.forEach((l) => l());
    },
};

export const useSyncStatus = (): SyncStatusSnapshot =>
    useSyncExternalStore(subscribe, syncStatus.getSnapshot, syncStatus.getSnapshot);

/**
 * What an EMPTY surface needs to tell "could not load" from "nothing here":
 *
 *   - `failed`: a sync of one of these scopes failed and has not recovered;
 *   - `loading`: one of them has a load in flight and has never answered since
 *     the cache was (re)built, so an empty list means "not read yet" (the first
 *     cold read can outlast the boot ceiling, which used to show "No tasks");
 *   - `retrying`: it failed and a re-run is in flight, so show the skeleton, not
 *     a stale error;
 *   - `retry`.
 *
 * Feed them to `DataState`; a surface with rows passes `hasData` and ignores all
 * of it. The hook is a SELECTOR: the store is written on every load start and
 * end, and a consumer re-renders only when its own three answers change (a
 * render storm in the task table was MIP-904).
 */
export const useSyncFailure = (...scopes: SyncScope[]) => {
    const answers = useSyncExternalStore(
        subscribe,
        () => answersFor(snapshot, scopes),
        () => answersFor(snapshot, scopes)
    );
    return {
        failed: answers[0] === "1",
        loading: answers[1] === "1",
        retrying: answers[2] === "1",
        retry: syncStatus.retry,
    };
};

// A string, not an object: `useSyncExternalStore` compares with `Object.is`.
const answersFor = (snap: SyncStatusSnapshot, scopes: readonly SyncScope[]): string => {
    let failed = false;
    let inFlight = false;
    let unanswered = false;
    for (const scope of scopes) {
        if (snap.failed.includes(scope)) failed = true;
        if (snap.inFlight.includes(scope)) {
            inFlight = true;
            if (!snap.answered.includes(scope)) unanswered = true;
        }
    }
    return `${failed ? 1 : 0}${unanswered ? 1 : 0}${failed && (snap.syncing || inFlight) ? 1 : 0}`;
};

/**
 * The open project's task load. Per project (MIP-1323): another project's
 * prefetch failing or succeeding does not change this one's answer. No project
 * open: nothing to fail.
 */
export const useTasksSyncFailure = (projectId: number | null | undefined) =>
    useSyncFailure(...(projectId ? [tasksScope(projectId)] : []));

/** The sync banner's answers (a selector, like `useSyncFailure`): the boot set only; the on-demand notes and flags reads say so where they are. */
export const useSyncBanner = () => {
    const answers = useSyncExternalStore(subscribe, bannerAnswers, bannerAnswers);
    const [failed, syncing, episode] = answers.split(",");
    return { failed: failed === "1", syncing: syncing === "1", episode: Number(episode) };
};

const bannerAnswers = (): string =>
    `${snapshot.failed.some(isBootScope) ? 1 : 0},${snapshot.syncing ? 1 : 0},${snapshot.episode}`;
