// Undo of an approved write: the data a turn carries about it, and the pure
// helpers that turn it into the list a turn shows.
//
// WHERE A TURN'S UNDO LIST COMES FROM
//   - a live turn: the `undo` on its tool events (`ToolEvent.undo`, copied from
//     the result event of an approved write). `AgentTurn` derives the list from
//     `toolEvents` itself, so the turn being streamed needs nothing from the host.
//   - a turn promoted from live: `CompletedTurn.undo`, computed once at
//     promotion (`undoStepsFromToolEvents`), because Spotlight persists turns
//     WITHOUT their tool events and the list has to survive that.
//   - a restored turn: the server's `undo` list of the session payload
//     (`undoStepsFromSession`); it has no tool events at all.
// `mergeUndoSteps` is the one place the sources are put together.

import type { AgentSessionTurn } from "../../services/agentApi";
import type { ToolEvent } from "./types";

/** One approved write that has an undo, as a turn knows it. */
export interface UndoStepRef {
    // The AgentStep's id: the key of the control and of its state in the store.
    stepId: number;
    // The step's index in its run. Orders the controls, newest first.
    step: number;
    toolName: string;
    // The run to POST against; null when it is not known, and then no control.
    runId: string | null;
    // ISO instant; the server stops offering the undo then.
    availableUntil: string;
    // ISO instant once the write was undone (a restored turn), else null.
    undoneAt: string | null;
}

/** What a click on Undo asks of the host. Never a body: the URL is all. */
export interface UndoRequest {
    runId: string;
    stepId: number;
    toolName: string;
}

// One identity for "no writes to undo", so a turn without any keeps its memo.
export const NO_UNDO_STEPS: readonly UndoStepRef[] = Object.freeze([]);

/** The undo of the finished writes among a turn's tool events. */
export const undoStepsFromToolEvents = (
    toolEvents: readonly ToolEvent[],
    runId?: string | null
): UndoStepRef[] =>
    toolEvents.flatMap((te) =>
        te.status === "done" && te.undo
            ? [
                  {
                      stepId: te.undo.step_id,
                      step: te.step,
                      toolName: te.tool_name,
                      runId: te.undo.run_id ?? runId ?? null,
                      availableUntil: te.undo.available_until,
                      undoneAt: null,
                  },
              ]
            : []
    );

/** The undo list of a restored session turn (oldest first, as the server sends it). */
export const undoStepsFromSession = (turn: AgentSessionTurn): UndoStepRef[] =>
    (Array.isArray(turn.undo) ? turn.undo : []).flatMap((u) =>
        u && typeof u.step_id === "number" && typeof u.available_until === "string"
            ? [
                  {
                      stepId: u.step_id,
                      step: typeof u.step === "number" ? u.step : 0,
                      toolName: typeof u.tool_name === "string" ? u.tool_name : "",
                      runId: turn.run_id || null,
                      availableUntil: u.available_until,
                      undoneAt: typeof u.undone_at === "string" ? u.undone_at : null,
                  },
              ]
            : []
    );

/**
 * The controls a turn shows: its tool events' undo and the list it carries,
 * once per write, NEWEST FIRST (the writes of one conversation are meant to be
 * undone newest first: undoing a created task while a later write built on it
 * is refused).
 *
 * `runId` is the turn's own run id, the fallback for an entry that names none.
 * An entry that says the write was undone wins over one that does not.
 */
export const mergeUndoSteps = (
    toolEvents: readonly ToolEvent[],
    carried: readonly UndoStepRef[] | undefined,
    runId?: string | null
): readonly UndoStepRef[] => {
    const fromEvents = undoStepsFromToolEvents(toolEvents, runId);
    if (fromEvents.length === 0 && (!carried || carried.length === 0)) return NO_UNDO_STEPS;
    const byStep = new Map<number, UndoStepRef>();
    for (const ref of [...fromEvents, ...(carried ?? [])]) {
        const known = byStep.get(ref.stepId);
        const merged: UndoStepRef = {
            ...(known ?? ref),
            ...ref,
            runId: ref.runId ?? known?.runId ?? runId ?? null,
            undoneAt: ref.undoneAt ?? known?.undoneAt ?? null,
        };
        byStep.set(ref.stepId, merged);
    }
    return [...byStep.values()].sort((a, b) => b.step - a.step || b.stepId - a.stepId);
};

/** True once `availableUntil` has passed on THIS clock. Only decides whether to
 * OFFER the button: the server is the authority and may refuse earlier or later.
 * A date that does not parse is not "past": the server decides. */
export const isPastAvailable = (availableUntil: string, now: number = Date.now()): boolean => {
    const until = Date.parse(availableUntil);
    return Number.isFinite(until) && now >= until;
};
