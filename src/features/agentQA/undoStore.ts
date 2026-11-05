// The state of each Undo, in ONE place for every host.
//
// A step's undo is idle -> undoing -> undone | refused, keyed by `step_id` (the
// AgentStep's primary key: unique across runs, so no run id is needed to key it).
// It lives here, at module level, rather than in `useAgentQA` or in the turn,
// for three reasons that each have bitten this app before:
//
//   - ONE implementation serves the thread Ask, the note Ask and Spotlight / the
//     Genos page. Each runs its own `useAgentQA` instance, but a step belongs to a
//     server run, not to an instance.
//   - A turn can be mounted TWICE at once. Spotlight's one conversation renders in
//     the Cmd-K overlay AND in the kept-alive Genos page; if either held its own
//     copy of "undoing" or "undone", the other would offer a second click on a
//     write that is already undone. Both read this.
//   - RENDER BUDGET (MIP-904). Putting the state in the hooks' `turns` would
//     re-render the conversation per click. Here only the one small control that
//     reads a step's state (`useSyncExternalStore`, `UndoControls.tsx`) re-renders;
//     the `AgentTurn` around it, and every other turn, does not.
//
// DOUBLE SUBMIT is refused here, not by `disabled`: the state flips to "undoing"
// synchronously, before the request is sent, so a second click in the same tick
// (or from the other mounted copy) finds it and sends nothing.
//
// REFRESH EVENTS are fired from the request's own completion, exactly once per
// undo, never from an effect watching the state: effects of a backgrounded,
// kept-alive Home still run, and a second copy of the control would fire again.

import { undoAgentStep, type UndoAnswer, type UndoRefusal } from "../../services/agentApi";
import { emitUndone } from "./undoRefresh";

export type UndoStepState =
    | { status: "idle" }
    // The request is in flight: the control is disabled and says "Undoing...".
    | { status: "undoing" }
    | { status: "undone"; answer: UndoAnswer }
    // Refused or failed. Nothing changed on the server. Whether the button comes
    // back is `refusal.retryable`.
    | { status: "refused"; refusal: UndoRefusal };

const IDLE: UndoStepState = Object.freeze({ status: "idle" });

// One immutable state object per step, replaced (never edited) on a change, so
// `getSnapshot` is stable between changes and only that step's listeners run.
const states = new Map<number, UndoStepState>();
const listeners = new Map<number, Set<() => void>>();

export const getUndoState = (stepId: number): UndoStepState => states.get(stepId) ?? IDLE;

export const subscribeUndo = (stepId: number, listener: () => void): (() => void) => {
    let set = listeners.get(stepId);
    if (!set) listeners.set(stepId, (set = new Set()));
    set.add(listener);
    return () => {
        set.delete(listener);
        if (set.size === 0) listeners.delete(stepId);
    };
};

const setUndoState = (stepId: number, next: UndoStepState): void => {
    states.set(stepId, next);
    // A copy: a listener may unsubscribe (unmount) while we notify.
    for (const listener of [...(listeners.get(stepId) ?? [])]) listener();
};

/**
 * Undo one step. Resolves when the request has settled; never rejects.
 *
 * Sends nothing when the step is already being undone, was undone, or was
 * refused for a reason a retry cannot change (409, 410, 403, 404: the server
 * said no about the state of the workspace, and asking again gets the same no).
 */
export const runUndo = async (args: {
    runId: string;
    stepId: number;
    accessToken: string | null;
}): Promise<void> => {
    const { runId, stepId, accessToken } = args;
    const current = getUndoState(stepId);
    if (current.status === "undoing" || current.status === "undone") return;
    if (current.status === "refused" && !current.refusal.retryable) return;

    setUndoState(stepId, { status: "undoing" });
    const result = await undoAgentStep({ runId, stepId, accessToken });
    if (result.kind === "refused") {
        setUndoState(stepId, { status: "refused", refusal: result.refusal });
        return;
    }
    setUndoState(stepId, { status: "undone", answer: result.answer });
    try {
        emitUndone(result.answer);
    } catch (err) {
        // The undo is done and shown; only the nudge to other surfaces failed.
        console.error("Undo: refreshing the app after an undo failed", err);
    }
};

/** Forget every step's state. For tests: the store is module-level. */
export const resetUndoStore = (): void => {
    states.clear();
    listeners.clear();
};
