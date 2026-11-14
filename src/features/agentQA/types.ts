// Shared agent-Q&A types + constants.
//
// These were previously inlined in `features/spotlight/useSpotlight.ts`.
// They live here so `useAgentQA` and every surface built on it (thread
// ask, note ask, Spotlight) reference one source of truth.

import type { AskAgentArgs, PendingApprovalPayload } from "../../services/agentApi";
import type { SpotlightResult } from "../spotlight/types";
import type { AgentMentionRef } from "./mentions/types";
import type { UndoRequest, UndoStepRef } from "./undoSteps";

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
    // Server-measured execution time, copied from the result/error
    // stream event. Absent while pending, on session-cache hits, and
    // against older backends — the strip shows a time only when set.
    duration_ms?: number;
    // Set from the result event of an approved write the person edited on the
    // card first: `edited_arguments` is `{path: value}`, the values that
    // actually ran (as typed). `arguments` already holds the effective call
    // (the resumed leg's start event shows it). Never set on an error, a read
    // or a plain approve.
    edited?: boolean;
    edited_arguments?: Record<string, unknown>;
    // Set from the result event of an approved write that can be undone: only
    // when the server really stored what undo needs, so this alone decides
    // whether the turn offers Undo. `run_id` is the run the approval resumed:
    // the result event does not name it, and the turn's own run id only
    // arrives with `done` (never, for a turn cancelled or failed after the write).
    undo?: { step_id: number; available_until: string; run_id?: string };
}

// Live state of the in-flight (or just-finished) turn.
export interface AskState {
    // True while the LLM stream is in flight (or paused on approval — see pendingApproval).
    isStreaming: boolean;
    // The query the answer is for. May lag behind the input.
    askedQuery: string;
    // Accumulated answer text from the streamed deltas.
    answer: string;
    // The turn's citation sources: the union of every `sources` event of the
    // turn, across an approval pause too (see `mergeSources`). Empty at the start
    // of each ask.
    answerSources: SpotlightResult[];
    // Set when the stream emits an error event (or transport fails).
    askError: string | null;
    // Per-step tool-call activity log. Ordered by step.
    toolEvents: ToolEvent[];
    // When the agent calls a write tool, the loop pauses here. The UI
    // renders Approve / Reject; either action resumes the same stream.
    pendingApproval: PendingApprovalPayload | null;
    // Set while `pendingApproval` is back on the card after the server
    // refused the person's edits (422, nothing was approved or run): the
    // sentence for each offending path, shown beside its field. Null / absent
    // otherwise. Cleared by the next attempt and by a new turn.
    approvalFieldErrors?: Record<string, string> | null;
    // The patch the server refused, so the restored card reopens with what
    // the person typed instead of making them type it again. Paired with
    // `approvalFieldErrors`.
    approvalEdits?: Record<string, unknown> | null;
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
    // finishes.
    runId?: string | null;
    // Total server-side wall time of the stream that finished this turn,
    // from the `done` event's `elapsed_ms`. Null/absent until then (and
    // against older backends). Powers the "Answered in Xs" line.
    elapsedMs?: number | null;
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
    // restored from older snapshots / cancelled before `done`.
    runId?: string | null;
    // The structured mentions this turn was asked with — Retry re-sends
    // them verbatim (labels are advisory; the server re-resolves + ACL-
    // checks on every ask, so a stale ref degrades to a silent drop).
    mentions?: AgentMentionRef[];
    // Total response time snapshot from AskState.elapsedMs (see there).
    elapsedMs?: number | null;
    // The approved writes of this turn that can be undone, oldest first. From
    // the turn's own tool events when it was live, from the server's list when
    // restored (a restored turn has no tool events), and kept when Spotlight
    // persists the turn (it strips the events). Absent when there are none.
    undo?: UndoStepRef[];
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
    approvalFieldErrors: null,
    approvalEdits: null,
    sessionId: null,
    turnId: 0,
    runId: null,
};

// i18n labels for the conversation PANEL and the INPUT of the Ask modals (thread
// Ask, note Ask): the empty-state hint, the input's placeholder and buttons, the
// mention dropdown's aria-label. Each modal builds this from its own i18n
// namespace and passes it as a prop, so these components stay string-free and
// locale-agnostic.
//
// What a TURN says (Q/A letters, approve/reject, copy, retry, thumbs, the
// chip vocabulary, ...) is NOT here: that is `AgentTurnLabels`
// (`agentTurnLabels.ts`), the one contract of the shared answer turn.
export interface AgentQALabels {
    conversation: {
        empty: string;
        placeholder: string;
        send: string;
        cancel: string;
    };
    // @/# mention dropdown a11y label. Required: it was optional once, with
    // an English fallback in the dropdown, and an omitted key just read
    // "Mention suggestions" in every language.
    mentions: {
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
    // The stream's total server-side wall time (`done.elapsed_ms`); null on
    // an error and against older backends.
    elapsedMs: number | null;
    // How many citation sources the answer came with. Mirrored from the
    // `sources` event because the state that holds them is not readable from
    // a stream handler's closure.
    sourceCount: number;
    // Whatever the surface passed as `onAsk`'s third argument, untouched.
    meta?: unknown;
}

// A finished answer shown without a stream (see `showStaticAnswer`).
export interface StaticAnswer {
    askedQuery: string;
    answer: string;
    answerSources: SpotlightResult[];
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
    // What an ask with no team does. Unset (thread / note): it is ignored
    // silently, as those modals only open inside a team. Set (Spotlight,
    // which is reachable before a team is chosen): the message becomes the
    // turn's error so the user sees why nothing happened. Either way no
    // request is sent and `onAsk` returns false.
    noTeamError?: string;
    // Continue the conversation the user can SEE: an ask that follows
    // completed turns under a live session sends `resume: true`, so a session
    // that idled out server-side is reused (within history retention) rather
    // than silently forked. Spotlight and the Genos page opt in — they
    // restore transcripts from history and localStorage; the thread / note
    // modals seed their session from the server and don't need it.
    resumeVisibleSession?: boolean;
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
    // query (retry re-sends the ones stored on the turn). `meta` is handed
    // back untouched as `AgentRunResult.meta`. Returns true when a request
    // was dispatched.
    onAsk: (overrideQuery?: string, mentions?: AgentMentionRef[], meta?: unknown) => boolean;
    onCancel: () => void;
    // `editedArgs` is the card's edit payload: ONLY the fields the person
    // changed, as `{path: value}`; absent or empty = approve as proposed. A
    // card must call this explicitly (never `onClick={onApprove}`: that would
    // pass the click event). A reject never carries edits; it takes only the
    // person's optional reason (MIP-889), and a plain Reject passes nothing.
    onApprove: (editedArgs?: Record<string, unknown>) => void;
    onReject: (reason?: string) => void;
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
    // Show a finished answer that did not come from a stream, in place of
    // the conversation (Spotlight's collected "Previous answer" cards).
    showStaticAnswer: (answer: StaticAnswer) => void;
    // Record 👍/👎 on a finished turn (F1). `rating`: 1 = up, -1 = down,
    // 0 = cleared. Fire-and-forget; failures are swallowed (feedback is
    // best-effort telemetry, never blocks the UI).
    submitFeedback: (runId: string, rating: number) => void;
    // Undo one approved write (the click on a turn's Undo control). Stable
    // identity; the state of the step lives in the undo store, not here, so this
    // never re-renders the conversation. See `undoStore.ts`.
    undoStep: (request: UndoRequest) => void;
}
