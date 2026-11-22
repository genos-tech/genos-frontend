import { useSyncExternalStore } from "react";

import { unionScope, type StatusScope } from "../utils/projectStatusScope";

/**
 * MIP-2000: which task statuses the local store holds for each project, and how many tasks
 * the server says each status has.
 *
 * The worker owns the truth (it is stored with the project's watermark); this is the main
 * thread's copy, filled from every project load's answer, so the filter bar can tell
 * "Closed is not loaded yet" from "Closed has no tasks", and the table can show its
 * skeleton while a missing status is on its way.
 *
 * - `loaded`: `undefined` until a load has answered this session, then the held statuses
 *   (`null` = all of them). It follows the worker's set, which only grows while the project's
 *   watermark stands.
 * - `counts`: the server's per-status counts over the whole project, from the newest
 *   answer that had them (an all-status answer has none and keeps the previous ones).
 * - `pending`: the scope a started widening will hold once it lands; while it is set the
 *   table draws its skeleton (MIP-1972) instead of an incomplete list.
 * - `wanted`: every scope a view asked for, kept after a failed fetch so a Retry asks again.
 *
 * An external store, like `milestoneSwitchStore`: one small component per reader re-renders,
 * not the whole task page.
 */
export interface ProjectStatusScopeState {
    loaded: StatusScope | undefined;
    counts: Record<string, number> | null;
    pending: StatusScope | undefined;
    /** Everything a view has asked for this session (kept after a failure). */
    wanted: StatusScope | undefined;
}

const EMPTY: ProjectStatusScopeState = {
    loaded: undefined,
    counts: null,
    pending: undefined,
    wanted: undefined,
};

const byProject = new Map<number, ProjectStatusScopeState>();
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

const read = (projectId: number): ProjectStatusScopeState => byProject.get(projectId) ?? EMPTY;

const write = (projectId: number, next: ProjectStatusScopeState) => {
    byProject.set(projectId, next);
    emit();
};

/** A load answered: what is held now and the server's counts. */
export const recordProjectScope = (
    projectId: number,
    answer: { statuses: readonly string[] | null; statusCounts: Record<string, number> | null }
) => {
    const prev = read(projectId);
    // The worker's answer is the truth. Loads of one project never overlap (the wrapper chains
    // them), so answers arrive in order; and the set can legitimately shrink back when the
    // store was emptied under the watermark (the team-wide load does that), in which case the
    // views that need more ask again.
    // `pending` is NOT cleared here: the rows reach the table only after the read that follows
    // the load, and the skeleton must stay up until then (`endScopeWidening` ends it).
    write(projectId, {
        ...prev,
        loaded: answer.statuses,
        counts: answer.statusCounts ?? prev.counts,
    });
};

/** What the project's stored rows hold, read from the worker before any load has answered
 *  this session (a reload, or a first load that failed offline). Never overrides an answer. */
export const primeProjectScope = (projectId: number, statuses: readonly string[] | null) => {
    const prev = read(projectId);
    if (prev.loaded !== undefined) return;
    write(projectId, { ...prev, loaded: statuses });
};

/** A widening to `need` starts: the table shows its skeleton until it lands. */
export const beginScopeWidening = (projectId: number, need: StatusScope) => {
    const prev = read(projectId);
    write(projectId, {
        ...prev,
        pending: prev.pending === undefined ? need : unionScope(prev.pending, need),
        // Remembered past a failure: a later plain refresh (the banner's Retry) loads these too,
        // instead of silently settling for the statuses the table opens on.
        wanted: prev.wanted === undefined ? need : unionScope(prev.wanted, need),
    });
};

/** The widening finished (landed or failed): never leave the skeleton up. */
export const endScopeWidening = (projectId: number) => {
    const prev = read(projectId);
    if (prev.pending === undefined) return;
    write(projectId, { ...prev, pending: undefined });
};

export const getProjectScope = (projectId: number | null | undefined): ProjectStatusScopeState =>
    projectId == null ? EMPTY : read(projectId);

/** Forget everything (a team switch or a wipe empties the stores this describes). */
export const resetProjectScopes = () => {
    if (byProject.size === 0) return;
    byProject.clear();
    emit();
};

const subscribe = (l: () => void) => {
    listeners.add(l);
    return () => {
        listeners.delete(l);
    };
};

export const useProjectStatusScope = (
    projectId: number | null | undefined
): ProjectStatusScopeState =>
    useSyncExternalStore(
        subscribe,
        () => getProjectScope(projectId),
        () => EMPTY
    );

/** True from the moment a widening starts until its rows are in the table (or it failed). */
export const isWidening = (state: ProjectStatusScopeState): boolean => state.pending !== undefined;
