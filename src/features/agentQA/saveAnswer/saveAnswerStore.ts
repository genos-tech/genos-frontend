// What became of the "Save as note" / "Save as task" of each answer.
//
// ONE STORE, KEYED BY THE TURN, so the buttons (in the hover-revealed action bar)
// and the status line (always on screen) agree, and so a turn mounted twice (the
// Spotlight overlay and the Genos page both show the conversation) shows the same
// state in both: a second click on an answer already saved is not offered. Read
// with `useSyncExternalStore`, so a save re-renders these two small controls and
// nothing above them: not the turn, not any other turn. Same shape as the undo
// store (`undoStore.ts`).
//
// The synchronous `beginSave` is the double-click guard: two clicks in one tick
// both see "idle" in a React state, but only one gets `true` here.

import type { SpotlightResult } from "../../spotlight/types";

export type SaveKind = "note" | "task";
export type SaveStatus = "idle" | "saving" | "saved" | "error";

/** Why a save did not happen, for the sentence the status line says. */
export type SaveFailure = "failed" | "tooLong" | "limitReached";

export interface SaveState {
    status: SaveStatus;
    // `saved`: the thing that was made, as the host's source-click wants it.
    target?: SpotlightResult;
    // `error`
    failure?: SaveFailure;
}

const IDLE: SaveState = { status: "idle" };

const states = new Map<string, SaveState>();
const listeners = new Map<string, Set<() => void>>();

const key = (turnKey: string, kind: SaveKind) => `${kind}\u0000${turnKey}`;

const notify = (turnKey: string) => {
    for (const listener of listeners.get(turnKey) ?? []) listener();
};

/** One turn's answer is identified by its run; a turn without one (an error is
 *  never saved, a restored one may lack it) by its text. */
export const turnKeyOf = (runId: string | null | undefined, askedQuery: string, answer: string) =>
    runId ? `run:${runId}` : `text:${askedQuery}\u0000${answer}`;

export const getSaveState = (turnKey: string, kind: SaveKind): SaveState =>
    states.get(key(turnKey, kind)) ?? IDLE;

/** Re-renders the subscriber when either kind of this turn changes. */
export const subscribeSave = (turnKey: string, listener: () => void): (() => void) => {
    let set = listeners.get(turnKey);
    if (!set) {
        set = new Set();
        listeners.set(turnKey, set);
    }
    set.add(listener);
    return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(turnKey);
    };
};

const put = (turnKey: string, kind: SaveKind, state: SaveState) => {
    states.set(key(turnKey, kind), state);
    notify(turnKey);
};

/** Claims the save. False when one is already running or already done. */
export const beginSave = (turnKey: string, kind: SaveKind): boolean => {
    const { status } = getSaveState(turnKey, kind);
    if (status === "saving" || status === "saved") return false;
    put(turnKey, kind, { status: "saving" });
    return true;
};

// `target` is absent when the server did not say what it made: still saved, no "Open".
export const finishSave = (turnKey: string, kind: SaveKind, target?: SpotlightResult) =>
    put(turnKey, kind, { status: "saved", target });

export const failSave = (turnKey: string, kind: SaveKind, failure: SaveFailure) =>
    put(turnKey, kind, { status: "error", failure });

/** Back to idle: the person closed the task dialog without creating. */
export const cancelSave = (turnKey: string, kind: SaveKind) => put(turnKey, kind, IDLE);

/** Tests only. */
export const resetSaveStore = () => {
    states.clear();
    listeners.clear();
};
