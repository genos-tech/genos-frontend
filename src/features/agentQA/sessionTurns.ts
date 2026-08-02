// Server-turn → local-turn mapping, shared by every surface that
// restores a persisted agent session into a live conversation
// (threadAsk / noteAsk bootstrap, Spotlight/Genos history resume).

import type { AgentSessionTurn } from "../../services/agentApi";
import type { CompletedTurn } from "./types";

// Map a server-side AgentSessionTurn (restored from a persisted run)
// to the local CompletedTurn shape the conversation views render. The
// local id is just a React key — derived from index since the server
// doesn't expose a numeric turn id, only `run_id` (UUID).
export const sessionTurnToCompleted = (turn: AgentSessionTurn, index: number): CompletedTurn => ({
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
});
