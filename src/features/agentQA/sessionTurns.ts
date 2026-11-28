// Server-turn → local-turn mapping, shared by every surface that
// restores a persisted agent session into a live conversation
// (threadAsk / noteAsk bootstrap, Spotlight/Genos history resume).

import type { AgentSessionTurn } from "../../services/agentApi";
import type { CompletedTurn, RestoredPendingAsk, UnansweredReason } from "./types";
import { undoStepsFromSession } from "./undoSteps";

// Why a persisted run has no answer, when the server's status says (MIP-2604).
export const unansweredReason = (turn: AgentSessionTurn): UnansweredReason | undefined => {
    // Said even when the ask wrote some text before it paused: without the line, that text reads as
    // if the write had been made (MIP-2613).
    if (turn.status === "awaiting_approval" && turn.approval_expired) return "expired";
    if (turn.answer || turn.error) return undefined;
    if (turn.status === "cancelled") return "cancelled";
    if (turn.status === "awaiting_approval") return "notDecided";
    return undefined;
};

// Map a server-side AgentSessionTurn (restored from a persisted run)
// to the local CompletedTurn shape the conversation views render. The
// local id is just a React key — derived from index since the server
// doesn't expose a numeric turn id, only `run_id` (UUID).
export const sessionTurnToCompleted = (turn: AgentSessionTurn, index: number): CompletedTurn => {
    // The only record of this turn's approved writes: it has no tool events.
    const undo = undoStepsFromSession(turn);
    const unanswered = unansweredReason(turn);
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
        ...(unanswered ? { unanswered } : {}),
        // The skill the turn ran (MIP-2189): kept as the same ref a live ask holds, so Retry sends `skill`
        // (and the version that ran) again instead of asking the words as a plain question.
        ...(turn.skill?.id
            ? {
                  mentions: [
                      {
                          kind: "skill" as const,
                          skillId: turn.skill.id,
                          label: turn.skill.slug,
                          version: turn.skill.version_no,
                      },
                  ],
              }
            : {}),
    };
};

// A whole restored session, ready for `reset`. Only the LAST turn can wait for a decision on the
// live card: an earlier one was left behind (the person asked something else since), and stays a
// finished turn that says so.
export const restoreSessionTurns = (
    turns: AgentSessionTurn[]
): { turns: CompletedTurn[]; pending: RestoredPendingAsk | null } => {
    const last = turns[turns.length - 1];
    const card = last?.status === "awaiting_approval" ? last.pending_approval : null;
    if (!card) return { turns: turns.map(sessionTurnToCompleted), pending: null };
    return {
        turns: turns.slice(0, -1).map(sessionTurnToCompleted),
        pending: { turn: sessionTurnToCompleted(last, turns.length - 1), card },
    };
};
