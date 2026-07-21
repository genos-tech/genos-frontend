// Shared agent-Q&A types + constants.
//
// These were previously inlined in `features/spotlight/useSpotlight.ts`.
// They now live here so `useAgentQA` (this package) and the per-entity
// wrappers (threadAsk, future noteAsk variants) all reference one source
// of truth. Spotlight still imports them from here pending the stretch
// goal of migrating its Q&A loop onto `useAgentQA`.

import type { AskAgentArgs, PendingApprovalPayload } from "../../services/agentApi";
import type { SpotlightResult } from "../spotlight/types";
import type { AgentMentionRef } from "./mentions/types";

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
    // AgentRun id returned on the `done` event. Carried so the completed
    // turn can attach 👍/👎 feedback (F1). Null/absent until the turn
    // finishes; optional so the un-migrated Spotlight loop (which reuses
    // this type) compiles without threading it.
    runId?: string | null;
    // Structured @/# mentions sent WITH this ask. Held so the completed
    // turn can carry them and Retry re-sends the identical refs instead
    // of degrading to plain text.
    askedMentions?: AgentMentionRef[];
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
    // AgentRun id for this turn (F1 feedback target). Absent for turns
    // restored from older snapshots / cancelled before `done`. Optional so
    // the un-migrated Spotlight loop (which reuses this type) compiles.
    runId?: string | null;
    // The structured mentions this turn was asked with — Retry re-sends
    // them verbatim (labels are advisory; the server re-resolves + ACL-
    // checks on every ask, so a stale ref degrades to a silent drop).
    mentions?: AgentMentionRef[];
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
    runId: null,
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
        // 👍/👎 feedback (F1). Optional so existing locale label sets
        // don't break; the component falls back to plain English titles.
        feedbackUp?: string;
        feedbackDown?: string;
    };
    states: {
        streaming: string;
        thinking: string;
    };
    approval: {
        // ICU-template-ish string with `{toolName}` placeholder.
        titleWithTool: string;
    };
    // @/# mention dropdown a11y label. Optional so existing locale
    // label sets don't break; the dropdown falls back to English.
    mentions?: {
        ariaLabel: string;
    };
}

// Terminal outcome of one agent turn, handed to `onRunComplete`.
// `error` is null on a clean finish and carries the failure message
// otherwise; exactly one `onRunComplete` fires per turn either way.
export interface AgentRunResult {
    turnId: number;
    askedQuery: string;
    answer: string;
    runId: string | null;
    error: string | null;
}

export interface UseAgentQAArgs {
    accessToken: string | null;
    teamId: string | null | undefined;
    // Called fresh on each ask to inject per-call payload extras
    // (`threadContext`, `noteContext`, etc.). Keeps the hook
    // policy-free — the caller decides what context the backend sees.
    buildAskExtras?: () => Partial<AskAgentArgs>;
    // Fired once when a turn reaches a terminal state (done OR error),
    // after it has been promoted into `turns`. Approval pauses do NOT
    // fire it — the turn isn't finished until the resumed stream ends.
    //
    // Exists so a caller can notify the user about an answer that landed
    // while its surface was closed (see `agentRunNotice.ts`). Kept as a
    // bare callback rather than a notification config so the hook stays
    // policy-free: whether a finished run is worth interrupting someone
    // over is the caller's call, not this state machine's.
    onRunComplete?: (result: AgentRunResult) => void;
}

export interface UseAgentQAReturn {
    query: string;
    setQuery: (q: string) => void;
    ask: AskState;
    turns: CompletedTurn[];
    sessionId: string | null;
    // `overrideQuery` lets a past turn's "Ask again" button re-fire its
    // original question without stomping the live input. `mentions` are
    // the structured @/# refs the input's picker collected for the live
    // query (retry passes none — the tokens remain in the text, but the
    // resolved ids aren't stored on completed turns in v1).
    onAsk: (overrideQuery?: string, mentions?: AgentMentionRef[]) => void;
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
    // Record 👍/👎 on a finished turn (F1). `rating`: 1 = up, -1 = down,
    // 0 = cleared. Fire-and-forget; failures are swallowed (feedback is
    // best-effort telemetry, never blocks the UI).
    submitFeedback: (runId: string, rating: number) => void;
}
