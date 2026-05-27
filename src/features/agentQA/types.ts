// Shared agent-Q&A types + constants.
//
// These were previously inlined in `features/spotlight/useSpotlight.ts`.
// They now live here so `useAgentQA` (this package) and the per-entity
// wrappers (threadAsk, future noteAsk variants) all reference one source
// of truth. Spotlight still imports them from here pending the stretch
// goal of migrating its Q&A loop onto `useAgentQA`.

import type { AskAgentArgs, PendingApprovalPayload } from "../../services/agentApi";
import type { SpotlightResult } from "../spotlight/types";

export type ToolEventStatus = "pending" | "done" | "error";

// Per-step record of a tool the agent invoked. The activity strip
// renders one row per event ordered by `step`.
export interface ToolEvent {
    step: number;
    tool_name: string;
    arguments: Record<string, unknown>;
    summary?: string;
    error?: string;
    status: ToolEventStatus;
}

// Live state of the in-flight (or just-finished) turn.
export interface AskState {
    // True while the LLM stream is in flight (or paused on approval — see pendingApproval).
    isStreaming: boolean;
    // The query the answer is for. May lag behind the input.
    askedQuery: string;
    // Accumulated answer text from the streamed deltas.
    answer: string;
    // Citation sources returned by the backend before the stream started.
    answerSources: SpotlightResult[];
    // Set when the stream emits an error event (or transport fails).
    askError: string | null;
    // Per-step tool-call activity log. Ordered by step.
    toolEvents: ToolEvent[];
    // When the agent calls a write tool, the loop pauses here. The UI
    // renders Approve / Reject; either action resumes the same stream.
    pendingApproval: PendingApprovalPayload | null;
    // Conversation session ID returned by the backend on the `done`
    // event. Sent back with subsequent /ask/ calls so the model sees
    // prior Q&A turns as context. Null means fresh session.
    sessionId: string | null;
    // Monotonic id for the current in-flight turn. Stream handlers gate
    // on this rather than `askedQuery` so identical-text re-asks don't
    // bleed state across turns.
    turnId: number;
}

// Immutable snapshot of a finished turn. Promoted into the `turns` array
// on stream done/error; the live `ask` represents only the current
// in-flight turn (or an empty slot between turns).
export interface CompletedTurn {
    id: number;
    askedQuery: string;
    answer: string;
    answerSources: SpotlightResult[];
    toolEvents: ToolEvent[];
    askError: string | null;
}

// Soft cap on how many completed turns we hold in client memory. The
// agent's own SESSION_MAX_PRIOR_TURNS (3 by default) controls how many
// the model actually sees; this cap is purely a UI memory bound.
export const MAX_TURNS_IN_HISTORY = 20;

// Empty initial AskState. Exported so callers can use the same constant
// when seeding state from a server snapshot.
export const EMPTY_ASK_STATE: AskState = {
    isStreaming: false,
    askedQuery: "",
    answer: "",
    answerSources: [],
    askError: null,
    toolEvents: [],
    pendingApproval: null,
    sessionId: null,
    turnId: 0,
};

// i18n labels for the conversation / input / approval / action UI. Each
// surface (threadAsk, Spotlight when migrated, future noteAsk variants)
// builds this from its own i18n namespace and passes it as a prop —
// agentQA components stay string-free and locale-agnostic.
export interface AgentQALabels {
    conversation: {
        empty: string;
        turnLabelQ: string;
        turnLabelA: string;
        placeholder: string;
        send: string;
        cancel: string;
    };
    actions: {
        approve: string;
        reject: string;
        copyAnswer: string;
        copied: string;
        retry: string;
    };
    states: {
        streaming: string;
        thinking: string;
    };
    approval: {
        // ICU-template-ish string with `{toolName}` placeholder.
        titleWithTool: string;
    };
}

export interface UseAgentQAArgs {
    accessToken: string | null;
    teamId: string | null | undefined;
    // Called fresh on each ask to inject per-call payload extras
    // (`threadContext`, `noteContext`, `allowWebSearch`, etc.). Keeps
    // the hook policy-free — the caller decides what context the
    // backend sees.
    buildAskExtras?: () => Partial<AskAgentArgs>;
}

export interface UseAgentQAReturn {
    query: string;
    setQuery: (q: string) => void;
    ask: AskState;
    turns: CompletedTurn[];
    sessionId: string | null;
    // `overrideQuery` lets a past turn's "Ask again" button re-fire its
    // original question without stomping the live input.
    onAsk: (overrideQuery?: string) => void;
    onCancel: () => void;
    onApprove: () => void;
    onReject: () => void;
    // Wipes turns + session locally and sets a one-shot flag so the
    // next /ask/ call tells the backend to start a fresh session even
    // if a per-context one already exists.
    clearConversation: () => void;
    // Full state replacement for when the caller's surrounding context
    // changes (e.g. user switched threads). Semantics:
    //   - `sessionId: undefined` = preserve current; `null` = clear.
    //   - `turns: undefined` = preserve current; `[]` = clear.
    // Lets callers do partial resets without accidentally wiping the
    // other half.
    reset: (args: { sessionId?: string | null; turns?: CompletedTurn[] }) => void;
}
