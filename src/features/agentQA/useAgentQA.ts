// Generic agent-Q&A state machine. Owns the turn list, the in-flight
// ask state, the abort controllers, and the stream-handler wiring
// for /api/v2/agent/ask/ + /api/v2/agent/decide/.
//
// This is the ONE ask/answer state machine: the thread ask, the note ask
// and Spotlight (the overlay and the Genos page) all run on it. Spotlight
// is a thin wrapper (`features/spotlight/useSpotlight`) that adds only what
// is Spotlight's own: the combined search+ask input, filters, History,
// localStorage persistence and the AI-answers setting.
//
// Policy-free by design — the hook knows nothing about threads, notes,
// Spotlight or any other entity context. Callers inject per-call payload
// extras via `buildAskExtras`, seed/replace the hook's state via `reset`
// when their surrounding context changes, and opt into the few behaviours
// that differ per surface through the options on `UseAgentQAArgs`
// (`noTeamError`, `resumeVisibleSession`, `onRunComplete`).
//
// Invariants (the Phase-12 contract, formerly duplicated in useSpotlight):
//   - Each ask gets a fresh monotonic `turnId`. Stream handlers gate
//     on `prev.turnId === askedTurnId` so a late event from a superseded
//     turn can't corrupt the current one.
//   - On `onDone` / `onError` the current `ask` is *promoted* into the
//     `turns` array (idempotent via `promotedTurnIdsRef`) and `ask` is
//     reset to empty (preserving `sessionId` + `turnId`).
//   - `decide` does NOT bump `turnId` — approve/reject is a continuation
//     of the same turn, completed by the resumed stream.
//   - The chips of a turn are the UNION of its `sources` events, never the
//     last one (see `mergeSources`): the resumed stream of a decided turn
//     does not repeat what the first stream found. A new ask starts empty.

import { useCallback, useEffect, useRef, useState } from "react";

import {
    askAgentStream,
    decideAgent,
    submitAgentFeedback,
    type PendingApprovalPayload,
    type ToolResultUndoRef,
} from "../../services/agentApi";
import type { SpotlightResult } from "../spotlight/types";
import { emitTasksBulkChanged, TASK_WRITE_TOOLS } from "../tasks/services/taskEvents";
import { emitProjectToolResult } from "./approvedProjectWrites";
import { toWireMentions, type AgentMentionRef } from "./mentions/types";
import { mergeSources } from "./mergeSources";
import { emitNoteChanged } from "./noteWriteTools";
import { emitTodoChanged } from "./todoWriteTools";
import {
    EMPTY_ASK_STATE,
    MAX_TURNS_IN_HISTORY,
    type AgentRunResult,
    type AskState,
    type CompletedTurn,
    type StaticAnswer,
    type ToolEvent,
    type UseAgentQAArgs,
    type UseAgentQAReturn,
} from "./types";
import { undoStepsFromToolEvents, type UndoRequest } from "./undoSteps";
import { runUndo } from "./undoStore";

// An edit patch worth sending: a plain `{path: value}` object with at least one
// entry. (Not an event, an array or null: see `decide`.)
const isEditPatch = (v: unknown): v is Record<string, unknown> =>
    v !== null &&
    typeof v === "object" &&
    !Array.isArray(v) &&
    Object.getPrototypeOf(v) === Object.prototype &&
    Object.keys(v).length > 0;

// Soft-capped append: the UI keeps the last MAX_TURNS_IN_HISTORY turns.
const appendTurn = (turns: CompletedTurn[], turn: CompletedTurn): CompletedTurn[] => {
    const next = [...turns, turn];
    return next.length > MAX_TURNS_IN_HISTORY
        ? next.slice(next.length - MAX_TURNS_IN_HISTORY)
        : next;
};

// Immutable snapshot of the live turn. Carries the structured mentions so
// "Ask again" on ANY promoted turn (finished, failed or cancelled) re-sends
// the same @/# references.
const snapshotTurn = (ask: AskState): CompletedTurn => {
    // The turn's undoable writes, kept as data of their own: Spotlight persists
    // turns without their tool events, and the list has to outlive that.
    const undo = undoStepsFromToolEvents(ask.toolEvents, ask.runId);
    return {
        id: ask.turnId,
        askedQuery: ask.askedQuery,
        answer: ask.answer,
        answerSources: ask.answerSources,
        toolEvents: ask.toolEvents,
        askError: ask.askError,
        runId: ask.runId ?? null,
        mentions: ask.askedMentions,
        elapsedMs: ask.elapsedMs ?? null,
        ...(undo.length > 0 ? { undo } : {}),
    };
};

export const useAgentQA = ({
    accessToken,
    teamId,
    buildAskExtras,
    onRunComplete,
    noTeamError,
    resumeVisibleSession = false,
}: UseAgentQAArgs): UseAgentQAReturn => {
    const [query, setQuery] = useState("");
    const [ask, setAsk] = useState<AskState>(EMPTY_ASK_STATE);
    const [turns, setTurns] = useState<CompletedTurn[]>([]);

    // Aborts: one per in-flight stream (ask + decide share the slot;
    // a new decide supersedes an older ask). Tracked in a ref so a
    // re-render doesn't drop the controller mid-stream.
    const askAbortRef = useRef<AbortController | null>(null);

    // Prevents double-promotion when both `onDone` and `onError` fire
    // for the same turn (the backend's stream may close cleanly even
    // after an error event, depending on how the run ended).
    const promotedTurnIdsRef = useRef<Set<number>>(new Set());

    // One-shot flag: when set, the next /ask/ call instructs the
    // backend to start a fresh AgentSession even if a context-scoped
    // one already exists. Used by `clearConversation` — without this,
    // a per-thread (or per-note) session-id lookup on the server would
    // silently inherit the cleared session and re-attach its history.
    const pendingNewConversationRef = useRef(false);

    // ---- Terminal-outcome plumbing for `onRunComplete`. ----
    //
    // The callback needs the turn's query + accumulated answer at the
    // moment the stream ends, but `onDone` can't read them from `ask`:
    // state updaters run during the commit phase, so a handler closure
    // only ever sees a stale snapshot. Mirroring the live turn into a
    // ref as the deltas arrive is what makes the terminal read correct.
    // (Firing the callback from inside the `setAsk` updater — where
    // `prev` *is* fresh — would be a side effect in an updater, which
    // StrictMode double-invokes.)
    const liveRunRef = useRef<AgentRunResult | null>(null);
    // The chips of the live turn, kept outside the state because a `sources`
    // event has to be folded into what the turn already has, and only here is
    // that readable (`prev` is only fresh inside an updater, which must stay
    // pure, and `onDone` cannot read state at all). Tagged with the turn id
    // like `liveRunRef`: a `decide` keeps the turn, so its resumed stream goes
    // on adding to the same list; a new ask starts a new, empty one. Null when
    // no turn is live, which is what drops a late event.
    const liveSourcesRef = useRef<{ turnId: number; sources: SpotlightResult[] } | null>(null);
    // Fires at most once per turn. Deliberately NOT `promotedTurnIdsRef`:
    // an explicit Cancel also promotes, and a run the user just cancelled
    // must not announce itself as finished.
    const completedTurnIdsRef = useRef<Set<number>>(new Set());
    // Held in a ref so `buildStreamHandlers` stays memoised — callers
    // typically pass an inline arrow that changes identity every render.
    const onRunCompleteRef = useRef(onRunComplete);
    useEffect(() => {
        onRunCompleteRef.current = onRunComplete;
    }, [onRunComplete]);

    const finishRun = useCallback((turnId: number, patch: Partial<AgentRunResult>) => {
        const live = liveRunRef.current;
        if (!live || live.turnId !== turnId) return;
        Object.assign(live, patch);
        if (completedTurnIdsRef.current.has(turnId)) return;
        completedTurnIdsRef.current.add(turnId);
        onRunCompleteRef.current?.({ ...live });
    }, []);

    // ---- Promote the current `ask` into the `turns` history. ----
    // Idempotent; safe to call from both onDone and onError.
    const promoteCurrentTurn = useCallback((turnId: number) => {
        if (promotedTurnIdsRef.current.has(turnId)) return;
        promotedTurnIdsRef.current.add(turnId);
        if (liveSourcesRef.current?.turnId === turnId) liveSourcesRef.current = null;
        setAsk((prev) => {
            if (prev.turnId !== turnId) return prev;
            const hasContent =
                Boolean(prev.answer) ||
                prev.toolEvents.length > 0 ||
                prev.answerSources.length > 0 ||
                Boolean(prev.askError);
            if (hasContent) {
                const snapshot = snapshotTurn(prev);
                setTurns((prevTurns) => appendTurn(prevTurns, snapshot));
            }
            return {
                ...EMPTY_ASK_STATE,
                sessionId: prev.sessionId,
                turnId: prev.turnId,
            };
        });
    }, []);

    // ---- Stream-handler factory, parameterised by turn id. ----
    // Shared by askAgentStream (fresh /ask/) and decideAgent (resume).
    // Both flows write into the same `ask` state, so the UI sees one
    // continuous answer panel across a pause + resume.
    //
    // `resumedRunId` is the run a /decide/ resumed. A result event names neither
    // its run nor (before `done`) does the turn, and the Undo of an approved
    // write needs one: it rides on the tool event from here.
    const buildStreamHandlers = useCallback(
        (askedTurnId: number, resumedRunId?: string) => {
            const stillCurrent = (prev: AskState) => prev.turnId === askedTurnId;
            return {
                onSources: (sources: SpotlightResult[]) => {
                    const live = liveSourcesRef.current;
                    if (!live || live.turnId !== askedTurnId) return;
                    // An event that adds nothing (the server's final re-rank
                    // of what it already sent, say) changes nothing: no state
                    // write, so no render.
                    const merged = mergeSources(live.sources, sources);
                    if (merged === live.sources) return;
                    live.sources = merged;
                    setAsk((prev) =>
                        stillCurrent(prev) ? { ...prev, answerSources: merged } : prev
                    );
                    // Mirror the count for `onRunComplete`: `onDone` lands before
                    // this state update is readable from a handler closure.
                    if (liveRunRef.current?.turnId === askedTurnId) {
                        liveRunRef.current.sourceCount = merged.length;
                    }
                },
                onDelta: (text: string) => {
                    setAsk((prev) =>
                        stillCurrent(prev) ? { ...prev, answer: prev.answer + text } : prev
                    );
                    if (liveRunRef.current?.turnId === askedTurnId) {
                        liveRunRef.current.answer += text;
                    }
                },
                onDone: (sessionId?: string, runId?: string, elapsedMs?: number) => {
                    setAsk((prev) =>
                        stillCurrent(prev)
                            ? {
                                  ...prev,
                                  isStreaming: false,
                                  ...(sessionId !== undefined ? { sessionId } : {}),
                                  ...(runId ? { runId } : {}),
                                  // Total response time for the "Answered
                                  // in Xs" line (absent on old backends).
                                  ...(typeof elapsedMs === "number" ? { elapsedMs } : {}),
                              }
                            : prev
                    );
                    promoteCurrentTurn(askedTurnId);
                    finishRun(askedTurnId, {
                        runId: runId ?? null,
                        elapsedMs: typeof elapsedMs === "number" ? elapsedMs : null,
                    });
                },
                onError: (message: string) => {
                    setAsk((prev) =>
                        stillCurrent(prev)
                            ? { ...prev, isStreaming: false, askError: message }
                            : prev
                    );
                    promoteCurrentTurn(askedTurnId);
                    finishRun(askedTurnId, { error: message });
                },
                onToolStart: ({
                    step,
                    tool_name,
                    arguments: args,
                }: {
                    step: number;
                    tool_name: string;
                    arguments: Record<string, unknown>;
                }) => {
                    setAsk((prev) => {
                        if (!stillCurrent(prev)) return prev;
                        // Resume re-announces the previously-paused tool —
                        // skip the duplicate row.
                        const dup = prev.toolEvents.some(
                            (te) =>
                                te.step === step &&
                                te.tool_name === tool_name &&
                                te.status === "pending"
                        );
                        if (dup) return prev;
                        const next: ToolEvent = {
                            step,
                            tool_name,
                            arguments: args,
                            status: "pending",
                        };
                        return { ...prev, toolEvents: [...prev.toolEvents, next] };
                    });
                },
                onToolResult: ({
                    step,
                    tool_name,
                    summary,
                    edited,
                    edited_arguments,
                    note,
                    note_folder,
                    duration_ms,
                    project,
                    undo,
                }: {
                    step: number;
                    tool_name: string;
                    summary: string;
                    edited?: boolean;
                    edited_arguments?: Record<string, unknown>;
                    note?: import("../../services/agentApi").ToolResultNoteRef;
                    note_folder?: import("../../services/agentApi").ToolResultNoteFolderRef;
                    duration_ms?: number;
                    project?: import("../../services/agentApi").ToolResultProjectRef;
                    undo?: ToolResultUndoRef;
                }) => {
                    setAsk((prev) => {
                        if (!stillCurrent(prev)) return prev;
                        return {
                            ...prev,
                            toolEvents: prev.toolEvents.map((te) =>
                                te.step === step &&
                                te.tool_name === tool_name &&
                                te.status === "pending"
                                    ? {
                                          ...te,
                                          status: "done" as const,
                                          summary,
                                          duration_ms,
                                          // Only an approve the person edited
                                          // carries these; the card of a plain
                                          // one stays exactly as it was.
                                          ...(edited === true && edited_arguments
                                              ? { edited: true, edited_arguments }
                                              : {}),
                                          // Only a write whose undo was really
                                          // stored carries one: it alone decides
                                          // whether the turn offers Undo.
                                          ...(undo
                                              ? {
                                                    undo: {
                                                        ...undo,
                                                        ...(resumedRunId
                                                            ? { run_id: resumedRunId }
                                                            : {}),
                                                    },
                                                }
                                              : {}),
                                      }
                                    : te
                            ),
                        };
                    });
                    // Cross-feature invalidator: the chat-side ToDoPane owns
                    // its own state and won't see an agent-written to-do
                    // (thread/note Q&A shares the write tools) unless we
                    // nudge it. useTodoGroups listens for this event and
                    // refetches. Mirrors the Spotlight overlay's handler.
                    emitTodoChanged(tool_name);
                    // Same idea for notes: a note written by the
                    // agent (thread/note Q&A shares the write tools) won't
                    // show in the note sidebar until a reload. Nudge
                    // useNoteManagement to refetch its meta, folder lists
                    // and Favorites. Mirrors the Spotlight overlay's handler.
                    // The refs carry what changed (id/type/changed_fields,
                    // `deleted`, a folder delete's ids) so useNoteManagement
                    // can push a body into the note's Yjs doc or drop what
                    // the server removed; undefined against older backends
                    // → meta-refetch only, exactly the previous behavior.
                    emitNoteChanged(tool_name, note, note_folder);
                    // Same idea for tasks/milestones: an approved agent
                    // write mutates rows outside the task UI's flows, so
                    // the table / diagram / milestone list would show
                    // stale data until a reload. (The decide/resume
                    // stream reuses these handlers, so approve-time
                    // results are covered too.)
                    if (TASK_WRITE_TOOLS.has(tool_name)) {
                        emitTasksBulkChanged();
                    }
                    // A deleted project leaves the sidebar, and an answered
                    // join request changes its inbox row on the server.
                    emitProjectToolResult(tool_name, project);
                },
                onToolError: ({
                    step,
                    tool_name,
                    error,
                    duration_ms,
                }: {
                    step: number;
                    tool_name: string;
                    error: string;
                    duration_ms?: number;
                }) => {
                    setAsk((prev) => {
                        if (!stillCurrent(prev)) return prev;
                        return {
                            ...prev,
                            toolEvents: prev.toolEvents.map((te) =>
                                te.step === step &&
                                te.tool_name === tool_name &&
                                te.status === "pending"
                                    ? { ...te, status: "error" as const, error, duration_ms }
                                    : te
                            ),
                        };
                    });
                },
                onPendingApproval: (payload: PendingApprovalPayload) => {
                    // No promotion here — the turn isn't done yet.
                    // The user must approve or reject, and the
                    // resumed stream's `onDone` is what promotes.
                    setAsk((prev) =>
                        stillCurrent(prev)
                            ? {
                                  ...prev,
                                  // Stream is "paused" not "ended". The UI
                                  // shows an Approve/Reject card; spinner
                                  // text changes from "streaming…" to a
                                  // waiting-for-user state.
                                  isStreaming: false,
                                  pendingApproval: payload,
                                  // A new pause starts clean: errors and a
                                  // draft belong to the card they came from.
                                  approvalFieldErrors: null,
                                  approvalEdits: null,
                              }
                            : prev
                    );
                },
            };
        },
        [promoteCurrentTurn, finishRun]
    );

    // ---- Send a question. ----
    //
    // Returns true when a request was dispatched (so a caller that owns its
    // own input draft knows whether to clear it), false when the ask was
    // ignored or answered locally (empty text, a run already in flight, no
    // team).
    //
    // `meta` is opaque to the hook: it rides along to `onRunComplete`
    // (`AgentRunResult.meta`) so a surface can tag an ask with something the
    // terminal callback needs (Spotlight: where the question came from).
    const onAsk = useCallback(
        (overrideQuery?: string, mentions?: AgentMentionRef[], meta?: unknown): boolean => {
            // `overrideQuery` wins when supplied (Retry on a past turn);
            // otherwise the live input is the source.
            const trimmed = (overrideQuery !== undefined ? overrideQuery : query).trim();
            if (!trimmed) return false;
            if (ask.isStreaming || ask.pendingApproval !== null) return false;
            if (!teamId) {
                // Surfaces that can render the problem (Spotlight) pass the
                // message and see it as the turn; the others stay silent.
                if (noTeamError) {
                    setAsk({
                        ...EMPTY_ASK_STATE,
                        sessionId: ask.sessionId,
                        turnId: ask.turnId + 1,
                        askedQuery: trimmed,
                        askError: noTeamError,
                    });
                }
                return false;
            }

            askAbortRef.current?.abort();
            const controller = new AbortController();
            askAbortRef.current = controller;

            // Read turnId+sessionId from the current `ask` synchronously —
            // updater closures don't see freshly-committed state in React 18
            // (updaters run during commit phase, after the synchronous
            // event handler returns). Forgetting this leaves the new
            // `askedTurnId` at the pre-bump value while the state's turnId
            // is already incremented, so every `stillCurrent` check would
            // return false and every stream event would be silently dropped.
            const askedTurnId = ask.turnId + 1;

            setAsk({
                isStreaming: true,
                askedQuery: trimmed,
                answer: "",
                answerSources: [],
                askError: null,
                toolEvents: [],
                pendingApproval: null,
                approvalFieldErrors: null,
                approvalEdits: null,
                sessionId: ask.sessionId,
                turnId: askedTurnId,
                runId: null,
                askedMentions: mentions?.length ? mentions : undefined,
            });

            // The turn's chips start empty, whatever the live slot held.
            liveSourcesRef.current = { turnId: askedTurnId, sources: [] };

            // Mirror of the turn that `onRunComplete` will report on.
            liveRunRef.current = {
                turnId: askedTurnId,
                askedQuery: trimmed,
                answer: "",
                runId: null,
                error: null,
                elapsedMs: null,
                sourceCount: 0,
                meta,
            };

            // Consume the "new conversation" flag (set by clearConversation).
            // One-shot — clears as soon as it's read so subsequent asks
            // continue the freshly-created session.
            const newConversation = pendingNewConversationRef.current;
            pendingNewConversationRef.current = false;

            const extras = buildAskExtras ? buildAskExtras() : undefined;

            void askAgentStream({
                query: trimmed,
                teamId,
                accessToken,
                sessionId: ask.sessionId ?? undefined,
                // Only on the wire when set: the field is absent, not `false`.
                ...(newConversation ? { newConversation } : {}),
                // Continuing a conversation the user can SEE (completed turns
                // under a live session) → tell the backend so an idle-expired
                // session is resumed rather than silently forked. First-ever
                // asks omit it.
                ...(resumeVisibleSession && turns.length > 0 && ask.sessionId
                    ? { resume: true }
                    : {}),
                signal: controller.signal,
                ...(mentions?.length ? { mentions: toWireMentions(mentions) } : {}),
                ...extras,
                ...buildStreamHandlers(askedTurnId),
            });

            // Clear the input so it's ready for the next question.
            setQuery("");
            return true;
        },
        [
            query,
            teamId,
            accessToken,
            buildAskExtras,
            buildStreamHandlers,
            noTeamError,
            resumeVisibleSession,
            ask.isStreaming,
            ask.pendingApproval,
            ask.turnId,
            ask.sessionId,
            turns.length,
        ]
    );

    // ---- Approve / Reject handlers for the pending write tool. ----
    //
    // The ONE implementation of the decision: the resume request is
    // started here, never from inside a `setAsk` updater (updaters must be
    // pure — StrictMode double-invokes them, which would have sent two
    // decisions for one click).
    //
    // `decide` does NOT bump `turnId`. Approve/reject is a continuation
    // of the same turn — the resumed stream's `onDone` is what promotes
    // it into history.
    //
    // The consumed approval token is remembered because the closure below
    // only sees the pending approval as of the last render: two clicks in
    // the same tick would both read it. (The old in-updater version got
    // this dedupe for free from the updater queue.)
    //
    // EDIT BEFORE APPROVE. An approve may carry `editedArgs`: only the fields
    // the person changed, as `{path: value}`. A reject never does (the server
    // answers 400 and consumes nothing), whatever the caller hands in. The
    // server checks the edits BEFORE it spends the approval, and a bad one is
    // a 422 `{error, field_errors}`, not a stream: nothing was approved or run
    // and the same token still works. That answer must give the card back, so:
    //   - the card was already swapped for the spinner on click, so a 422
    //     restores the SAME pending approval, with the sentence per path and
    //     the patch that was refused (the card reopens on what was typed);
    //   - the dedupe is released, or the person could never fix the typo and
    //     approve again;
    //   - a 422 that arrives after Cancel, a reset or a newer decision is
    //     dropped (that request was aborted or superseded).
    const decidedApprovalTokenRef = useRef<string | null>(null);
    const decide = useCallback(
        (decision: "approve" | "reject", editedArgs?: Record<string, unknown>) => {
            const payload = ask.pendingApproval;
            if (!payload) return;
            if (decidedApprovalTokenRef.current === payload.approval_token) return;
            decidedApprovalTokenRef.current = payload.approval_token;
            const askedTurnId = ask.turnId;
            // Only a plain object with something in it is an edit: a card that
            // wires `onClick={onApprove}` hands over the click event instead.
            const edits =
                decision === "approve" && isEditPatch(editedArgs) ? editedArgs : undefined;

            // Reuse the abort handle — the new request supersedes
            // anything older.
            askAbortRef.current?.abort();
            const controller = new AbortController();
            askAbortRef.current = controller;

            // Flip back to streaming; the resumed stream's
            // tool_call_start / result / error events fill in the
            // pending row (deduped via buildStreamHandlers).
            setAsk((prev) =>
                prev.turnId === askedTurnId && prev.pendingApproval
                    ? {
                          ...prev,
                          pendingApproval: null,
                          isStreaming: true,
                          approvalFieldErrors: null,
                          approvalEdits: null,
                      }
                    : prev
            );

            void decideAgent({
                runId: payload.run_id,
                approvalToken: payload.approval_token,
                decision,
                ...(edits ? { editedArgs: edits } : {}),
                accessToken,
                signal: controller.signal,
                ...buildStreamHandlers(askedTurnId, payload.run_id),
                onEditsRejected: ({ fieldErrors }) => {
                    if (askAbortRef.current !== controller || controller.signal.aborted) return;
                    if (decidedApprovalTokenRef.current === payload.approval_token) {
                        decidedApprovalTokenRef.current = null;
                    }
                    setAsk((prev) =>
                        prev.turnId === askedTurnId && prev.pendingApproval === null
                            ? {
                                  ...prev,
                                  isStreaming: false,
                                  pendingApproval: payload,
                                  approvalFieldErrors: fieldErrors,
                                  approvalEdits: edits ?? null,
                              }
                            : prev
                    );
                },
            });
        },
        [ask.pendingApproval, ask.turnId, accessToken, buildStreamHandlers]
    );

    const onApprove = useCallback(
        (editedArgs?: Record<string, unknown>) => decide("approve", editedArgs),
        [decide]
    );
    // Takes no edits: a reject that carried any would be a 400.
    const onReject = useCallback(() => decide("reject"), [decide]);

    // ---- Cancel the in-flight answer. ----
    // Aborting the fetch throws AbortError which is silently swallowed
    // by the stream consumer — it returns without calling any handler.
    // So we manually promote (or discard) the partial turn here,
    // otherwise `ask.isStreaming` would stay true forever.
    const onCancel = useCallback(() => {
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        // The user asked for this to stop — no "your answer is ready".
        // Marking the turn complete without invoking the callback also
        // blocks a late in-flight event from announcing it afterwards.
        if (liveRunRef.current) completedTurnIdsRef.current.add(liveRunRef.current.turnId);
        liveRunRef.current = null;
        liveSourcesRef.current = null;
        setAsk((prev) => {
            if (!prev.isStreaming && prev.pendingApproval === null) return prev;
            const turnId = prev.turnId;
            if (!promotedTurnIdsRef.current.has(turnId)) {
                promotedTurnIdsRef.current.add(turnId);
                // Keep whatever partial content arrived before cancel. The
                // snapshot carries the mentions, so "Ask again" on a cancelled
                // turn re-sends the same @/# references.
                const hasContent =
                    Boolean(prev.answer) ||
                    prev.toolEvents.length > 0 ||
                    prev.answerSources.length > 0;
                if (hasContent) {
                    const snapshot = snapshotTurn(prev);
                    setTurns((prevTurns) => appendTurn(prevTurns, snapshot));
                }
            }
            return { ...EMPTY_ASK_STATE, sessionId: prev.sessionId, turnId: prev.turnId };
        });
    }, []);

    // ---- Wipe the conversation locally + signal "new session" to backend. ----
    // Sets `pendingNewConversationRef` so the next /ask/ tells the
    // backend to start a fresh AgentSession rather than reusing the
    // existing context-scoped one — without this, the server's lookup
    // would re-attach the cleared turns on the next page load.
    const clearConversation = useCallback(() => {
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        // `turnId` restarts at 0 here, so the completed set must be
        // cleared too or the first turn of the new conversation would be
        // treated as already-announced.
        liveRunRef.current = null;
        liveSourcesRef.current = null;
        completedTurnIdsRef.current.clear();
        promotedTurnIdsRef.current.clear();
        pendingNewConversationRef.current = true;
        setTurns([]);
        setAsk(EMPTY_ASK_STATE);
        setQuery("");
    }, []);

    // ---- State replacement for context switches / server snapshot. ----
    // Callers invoke when their surrounding context changes (e.g. the
    // user opened the modal on a different thread) or when they want
    // to seed from a server-persisted snapshot. Semantics:
    //   - `sessionId: undefined` = preserve; `null` = clear.
    //   - `turns: undefined` = preserve; `[]` = clear.
    //   - In-flight ask state is always cleared (any in-flight stream
    //     is aborted) since the new state may have a different turnId
    //     sequence; the caller can preserve query separately by not
    //     touching `setQuery`.
    // The promoted-turns ref is rebuilt to match the new turn list so
    // a stale handler can't double-promote a turn that was restored
    // from a server snapshot.
    const reset = useCallback((args: { sessionId?: string | null; turns?: CompletedTurn[] }) => {
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        // Same reasoning as `onCancel`: the context this run belonged to
        // is gone, so its completion is no longer worth announcing.
        // Dropping the live mirror is what suppresses it — `finishRun`
        // no-ops without one, even if a late event slips through. The
        // completed set is then CLEARED rather than added to, because
        // `reset` rewinds `turnId` to match the restored history and a
        // stale id in the set would mute a genuine future run.
        liveRunRef.current = null;
        liveSourcesRef.current = null;
        completedTurnIdsRef.current.clear();
        pendingNewConversationRef.current = false;
        if (args.turns !== undefined) {
            setTurns(args.turns);
            promotedTurnIdsRef.current = new Set(args.turns.map((t) => t.id));
        }
        setAsk((prev) => {
            const nextSessionId = args.sessionId === undefined ? prev.sessionId : args.sessionId;
            // Seed turnId from the highest restored id so the next ask
            // doesn't collide. Falls back to current if no turns supplied.
            const seedTurnId =
                args.turns !== undefined && args.turns.length > 0
                    ? args.turns[args.turns.length - 1].id
                    : args.turns !== undefined
                      ? 0
                      : prev.turnId;
            return {
                ...EMPTY_ASK_STATE,
                sessionId: nextSessionId,
                turnId: seedTurnId,
            };
        });
    }, []);

    // ---- Show a finished answer that did not come from a stream. ----
    // Spotlight's "Previous answer" cards (a collected answer returned by
    // search) render through the live-answer renderer: no request, nothing
    // for the model to see. Resets like a new conversation first, so the
    // answer stands alone instead of trailing an unrelated one; the answer
    // then sits in the live slot (never promoted into `turns`) until the
    // next ask replaces it. `turnId` keeps counting up so a straggler from
    // the aborted turn can never match it.
    const showStaticAnswer = useCallback((answer: StaticAnswer) => {
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        liveRunRef.current = null;
        liveSourcesRef.current = null;
        promotedTurnIdsRef.current.clear();
        setTurns([]);
        setAsk((prev) => ({
            ...EMPTY_ASK_STATE,
            turnId: prev.turnId + 1,
            askedQuery: answer.askedQuery,
            answer: answer.answer,
            answerSources: answer.answerSources,
        }));
    }, []);

    // ---- Record 👍/👎 on a finished turn (F1). ----
    // Fire-and-forget: the answer is already shown, so a feedback POST
    // failing must never surface to the user. The component owns the
    // optimistic button state; this just persists the signal.
    const submitFeedback = useCallback(
        (runId: string, rating: number) => {
            if (!runId || !accessToken) return;
            void submitAgentFeedback({ runId, rating, accessToken });
        },
        [accessToken]
    );

    // ---- Undo one approved write. ----
    // The state of the step is not here (see `undoStore.ts`): this only starts the
    // request, with the live token read through a ref so the callback keeps ONE
    // identity for the life of the hook and never re-renders a turn.
    const accessTokenRef = useRef(accessToken);
    accessTokenRef.current = accessToken;
    const undoStep = useCallback(
        ({ runId, stepId }: UndoRequest) =>
            void runUndo({ runId, stepId, accessToken: accessTokenRef.current }),
        []
    );

    return {
        query,
        setQuery,
        ask,
        turns,
        sessionId: ask.sessionId,
        onAsk,
        onCancel,
        onApprove,
        onReject,
        clearConversation,
        reset,
        showStaticAnswer,
        submitFeedback,
        undoStep,
    };
};
