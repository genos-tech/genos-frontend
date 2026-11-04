// Server-turn → local-turn mapping, shared by every surface that
// restores a persisted agent session into a live conversation
// (threadAsk / noteAsk bootstrap, Spotlight/Genos history resume).

import type { AgentSessionTurn } from "../../services/agentApi";
import type { CompletedTurn } from "./types";
import { undoStepsFromSession } from "./undoSteps";

// Map a server-side AgentSessionTurn (restored from a persisted run)
// to the local CompletedTurn shape the conversation views render. The
// local id is just a React key — derived from index since the server
// doesn't expose a numeric turn id, only `run_id` (UUID).
export const sessionTurnToCompleted = (turn: AgentSessionTurn, index: number): CompletedTurn => {
    // The only record of this turn's approved writes: it has no tool events.
    const undo = undoStepsFromSession(turn);
    return {
        id: index + 1,
        askedQuery: turn.query,
        answer: turn.answer,
        answerSources: turn.sources || [],
        // toolEvents are not persisted on AgentRun — the activity strip
        // is "show what happened LIVE", not part of the durable record.
        // Restored turns render without it; the prior answer + sources
        // are enough context.
        toolEvents: [],
        askError: turn.error || null,
        // Carry run_id so restored turns can still be rated (F1).
        runId: turn.run_id,
        // Absent (not `[]`) when the turn has no writes to undo.
        ...(undo.length > 0 ? { undo } : {}),
    };
};
