// useThreadAsk — state + behavior for the "Ask about this thread" modal
// launched from ThreadChatPaneHeader.
//
// Two phases:
//   1. **Summary** — on open, fetch `/agent/thread-summary/`. The
//      backend returns either a cached row (no LLM cost) or generates
//      a fresh summary. We display it and start a 30 s background poll
//      that re-fetches the fingerprint. If the fingerprint drifts (new
//      messages, edit, delete), set `staleSummary=true` so the UI can
//      surface a "Refresh summary?" banner.
//   2. **Q&A** — the user asks follow-up questions via
//      `askAgentStream`, passing `threadContext`. The backend scopes
//      the agent to this thread only (workspace tools disabled,
//      `fetch_chat_thread` enabled, summary injected into system prompt).
//
// State is preserved across modal close/reopen so an accidental close
// doesn't lose the conversation; switching to a different thread tears
// down the hook (it's mounted per-ThreadChatPaneHeader), giving each
// thread its own clean slate.

import { useCallback, useEffect, useRef, useState } from "react";

import {
    askAgentStream,
    fetchThreadSummary,
    type AgentSessionTurn,
    type PendingApprovalPayload,
    type ThreadContext,
    type ThreadSummaryResponse,
} from "../../services/agentApi";
import type { SpotlightResult } from "../spotlight/types";
import type { AskState, CompletedTurn, ToolEvent } from "../spotlight/useSpotlight";

// Map a server-side AgentSessionTurn (restored from a persisted run)
// to the local CompletedTurn shape the modal renders. The local id
// is just a React key — derived from index since the server doesn't
// expose a numeric turn id, only `run_id` (UUID).
const sessionTurnToCompleted = (turn: AgentSessionTurn, index: number): CompletedTurn => ({
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
});

// How often we re-check the server's fingerprint while the modal is
// open. 30 s is a generous compromise — the backend call is cheap
// (peek-only, no LLM) and even a multi-team thread doesn't churn faster.
const FINGERPRINT_POLL_MS = 30_000;

// Soft cap on stored turns. Matches the corresponding bound in
// useSpotlight: the model itself only sees the last few via the
// backend's SESSION_MAX_PRIOR_TURNS, so a larger UI buffer is fine.
const MAX_TURNS = 20;

const EMPTY_ASK_STATE: AskState = {
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

export interface UseThreadAskArgs {
    accessToken: string | null;
    teamId: string | null | undefined;
}

export interface ThreadSummaryState {
    text: string;
    lastUpdatedIso: string;
    fingerprint: string;
    messageCount: number;
}

export interface UseThreadAskReturn {
    // ---- Open / close ----
    isOpen: boolean;
    open: (threadContext: ThreadContext) => void;
    close: () => void;

    // The thread the modal is currently bound to. Null when the user
    // hasn't opened it yet, or when it was opened with no context.
    threadContext: ThreadContext | null;

    // ---- Summary ----
    summary: ThreadSummaryState | null;
    summaryLoading: boolean;
    summaryError: string | null;
    refreshSummary: () => void;
    // True when the background fingerprint poll detected drift since
    // the displayed summary. UI shows a "new messages — refresh?" banner.
    staleSummary: boolean;

    // ---- Q&A ----
    query: string;
    setQuery: (q: string) => void;
    ask: AskState;
    turns: CompletedTurn[];
    onAsk: () => void;
    onCancel: () => void;
    clearConversation: () => void;
}

export const useThreadAsk = ({ accessToken, teamId }: UseThreadAskArgs): UseThreadAskReturn => {
    const [isOpen, setIsOpen] = useState(false);
    const [threadContext, setThreadContext] = useState<ThreadContext | null>(null);

    const [summary, setSummary] = useState<ThreadSummaryState | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [staleSummary, setStaleSummary] = useState(false);

    const [query, setQuery] = useState("");
    const [ask, setAsk] = useState<AskState>(EMPTY_ASK_STATE);
    const [turns, setTurns] = useState<CompletedTurn[]>([]);

    // Aborts: one for the in-flight summary fetch, one for the in-flight
    // ask stream. Tracked separately so a summary refresh doesn't kill
    // an active answer (and vice versa).
    const summaryAbortRef = useRef<AbortController | null>(null);
    const askAbortRef = useRef<AbortController | null>(null);

    // Prevents double-promotion when both `onDone` and `onError` fire
    // for the same turn.
    const promotedTurnIdsRef = useRef<Set<number>>(new Set());
    // One-shot flag: when set, the next /ask/ call instructs the
    // backend to start a fresh AgentSession even if a per-thread one
    // already exists. Used by `clearConversation` — without this, the
    // backend's thread-context lookup would silently inherit the
    // cleared session and re-attach its history on the next page load.
    const pendingNewConversationRef = useRef(false);

    // ---- Load / refresh the summary. Shared by `open` and `refreshSummary`. ----
    const loadSummary = useCallback(
        (ctx: ThreadContext, force: boolean) => {
            if (!accessToken || !teamId) {
                setSummaryError("Missing auth or team.");
                return;
            }
            summaryAbortRef.current?.abort();
            const controller = new AbortController();
            summaryAbortRef.current = controller;
            setSummaryLoading(true);
            setSummaryError(null);
            setStaleSummary(false);
            void (async () => {
                try {
                    const data: ThreadSummaryResponse = await fetchThreadSummary({
                        accessToken,
                        teamId,
                        threadContext: ctx,
                        forceRegenerate: force,
                        signal: controller.signal,
                    });
                    if (controller.signal.aborted) return;
                    setSummary({
                        text: data.summary,
                        lastUpdatedIso: data.last_updated_iso,
                        fingerprint: data.fingerprint,
                        messageCount: data.message_count,
                    });
                    // Restore prior Q&A from the server. Only fires when
                    // there ARE prior turns — otherwise we'd stomp on
                    // any in-progress turns the user has already typed
                    // (the modal can be re-opened mid-conversation).
                    if (data.turns && data.turns.length > 0) {
                        const restored = data.turns.map(sessionTurnToCompleted);
                        setTurns(restored);
                        // Pre-seed the next turnId so a new ask doesn't
                        // collide with the restored ids.
                        promotedTurnIdsRef.current = new Set(restored.map((t) => t.id));
                        setAsk((prev) => ({
                            ...prev,
                            sessionId: data.agent_session_id,
                            turnId: restored[restored.length - 1].id,
                        }));
                    } else if (data.agent_session_id) {
                        // No turns yet but server has a session id (rare —
                        // only happens if the user opened the modal, asked
                        // nothing, and reopened later). Bind it anyway so
                        // the next ask continues the same session.
                        setAsk((prev) => ({
                            ...prev,
                            sessionId: data.agent_session_id,
                        }));
                    }
                } catch (err) {
                    if (controller.signal.aborted) return;
                    const message = err instanceof Error ? err.message : "Load failed";
                    setSummaryError(message);
                } finally {
                    if (!controller.signal.aborted) setSummaryLoading(false);
                }
            })();
        },
        [accessToken, teamId]
    );

    const open = useCallback(
        (ctx: ThreadContext) => {
            setIsOpen(true);
            // Switching to a different thread tears down the existing
            // conversation: a Q&A about thread A makes no sense for thread B.
            const sameThread =
                threadContext !== null &&
                threadContext.chatType === ctx.chatType &&
                threadContext.chatId === ctx.chatId &&
                threadContext.threadId === ctx.threadId;
            if (!sameThread) {
                setThreadContext(ctx);
                setSummary(null);
                setStaleSummary(false);
                setAsk(EMPTY_ASK_STATE);
                setTurns([]);
                setQuery("");
                promotedTurnIdsRef.current.clear();
                loadSummary(ctx, false);
            } else if (!summary && !summaryLoading) {
                // Same thread but no summary yet (e.g. previous load
                // failed and we're reopening). Re-attempt.
                loadSummary(ctx, false);
            }
        },
        [threadContext, summary, summaryLoading, loadSummary]
    );

    const close = useCallback(() => {
        setIsOpen(false);
        // Abort an in-flight summary fetch; the in-flight ask stream
        // we leave alone — preserving its partial answer if the user
        // reopens.
        summaryAbortRef.current?.abort();
        summaryAbortRef.current = null;
    }, []);

    const refreshSummary = useCallback(() => {
        if (!threadContext) return;
        // Don't force-regenerate. The shared-cache design means another
        // member of the thread may have *already* refreshed it after the
        // new messages arrived — in that case we want the cached row,
        // not another LLM call. The backend's fingerprint check decides.
        loadSummary(threadContext, false);
    }, [threadContext, loadSummary]);

    // ---- Background fingerprint polling: detect new messages while open. ----
    useEffect(() => {
        if (!isOpen || !threadContext || !accessToken || !teamId) return;
        // Only poll once we have a summary to compare against; otherwise
        // the initial fetch is still in flight.
        if (!summary) return;
        const displayedFingerprint = summary.fingerprint;
        let cancelled = false;
        const interval = window.setInterval(async () => {
            try {
                const data = await fetchThreadSummary({
                    accessToken,
                    teamId,
                    threadContext,
                    forceRegenerate: false,
                });
                if (cancelled) return;
                if (data.fingerprint !== displayedFingerprint) {
                    // Different fingerprint = thread evolved. The
                    // server's response may be a cache hit (still
                    // matching the *new* state), so we only flag stale
                    // — we don't auto-replace the displayed summary.
                    setStaleSummary(true);
                }
            } catch {
                // Silent: a transient network blip shouldn't spam the UI.
            }
        }, FINGERPRINT_POLL_MS);
        return () => {
            cancelled = true;
            window.clearInterval(interval);
        };
    }, [isOpen, threadContext, accessToken, teamId, summary]);

    // ---- Promote the current `ask` into the `turns` history. ----
    // Idempotent; safe to call from both onDone and onError.
    const promoteCurrentTurn = useCallback((turnId: number) => {
        if (promotedTurnIdsRef.current.has(turnId)) return;
        promotedTurnIdsRef.current.add(turnId);
        setAsk((prev) => {
            if (prev.turnId !== turnId) return prev;
            const hasContent =
                Boolean(prev.answer) ||
                prev.toolEvents.length > 0 ||
                prev.answerSources.length > 0 ||
                Boolean(prev.askError);
            if (hasContent) {
                const snapshot: CompletedTurn = {
                    id: prev.turnId,
                    askedQuery: prev.askedQuery,
                    answer: prev.answer,
                    answerSources: prev.answerSources,
                    toolEvents: prev.toolEvents,
                    askError: prev.askError,
                };
                setTurns((prevTurns) => {
                    const next = [...prevTurns, snapshot];
                    return next.length > MAX_TURNS ? next.slice(next.length - MAX_TURNS) : next;
                });
            }
            return {
                ...EMPTY_ASK_STATE,
                sessionId: prev.sessionId,
                turnId: prev.turnId,
            };
        });
    }, []);

    // ---- Stream handler builder, parameterized by the turn id. ----
    // Mirrors the gate-on-turnId pattern from useSpotlight: identical
    // re-asks of the same query text don't cross-pollute each other.
    const buildStreamHandlers = useCallback(
        (askedTurnId: number) => {
            const stillCurrent = (prev: AskState) => prev.turnId === askedTurnId;
            return {
                onSources: (sources: SpotlightResult[]) => {
                    setAsk((prev) =>
                        stillCurrent(prev) ? { ...prev, answerSources: sources } : prev
                    );
                },
                onDelta: (text: string) => {
                    setAsk((prev) =>
                        stillCurrent(prev) ? { ...prev, answer: prev.answer + text } : prev
                    );
                },
                onDone: (sessionId?: string) => {
                    setAsk((prev) =>
                        stillCurrent(prev)
                            ? {
                                  ...prev,
                                  isStreaming: false,
                                  ...(sessionId !== undefined ? { sessionId } : {}),
                              }
                            : prev
                    );
                    promoteCurrentTurn(askedTurnId);
                },
                onError: (message: string) => {
                    setAsk((prev) =>
                        stillCurrent(prev)
                            ? { ...prev, isStreaming: false, askError: message }
                            : prev
                    );
                    promoteCurrentTurn(askedTurnId);
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
                }: {
                    step: number;
                    tool_name: string;
                    summary: string;
                }) => {
                    setAsk((prev) => {
                        if (!stillCurrent(prev)) return prev;
                        return {
                            ...prev,
                            toolEvents: prev.toolEvents.map((te) =>
                                te.step === step &&
                                te.tool_name === tool_name &&
                                te.status === "pending"
                                    ? { ...te, status: "done" as const, summary }
                                    : te
                            ),
                        };
                    });
                },
                onToolError: ({
                    step,
                    tool_name,
                    error,
                }: {
                    step: number;
                    tool_name: string;
                    error: string;
                }) => {
                    setAsk((prev) => {
                        if (!stillCurrent(prev)) return prev;
                        return {
                            ...prev,
                            toolEvents: prev.toolEvents.map((te) =>
                                te.step === step &&
                                te.tool_name === tool_name &&
                                te.status === "pending"
                                    ? { ...te, status: "error" as const, error }
                                    : te
                            ),
                        };
                    });
                },
                // The thread Q&A flow disables all write tools, so this
                // shouldn't fire — but plumbing it through means a future
                // tool-allow-list change wouldn't silently break the UI.
                onPendingApproval: (payload: PendingApprovalPayload) => {
                    setAsk((prev) =>
                        stillCurrent(prev)
                            ? { ...prev, isStreaming: false, pendingApproval: payload }
                            : prev
                    );
                },
            };
        },
        [promoteCurrentTurn]
    );

    // ---- Send a question. ----
    const onAsk = useCallback(() => {
        const trimmed = query.trim();
        if (!trimmed) return;
        if (!threadContext || !teamId) return;
        if (ask.isStreaming || ask.pendingApproval !== null) return;

        askAbortRef.current?.abort();
        const controller = new AbortController();
        askAbortRef.current = controller;

        // Read turnId+sessionId from the current `ask` synchronously —
        // updater closures don't see freshly-committed state. See the
        // matching comment in useSpotlight.onAsk for the failure mode
        // when this is forgotten.
        const askedTurnId = ask.turnId + 1;

        setAsk({
            isStreaming: true,
            askedQuery: trimmed,
            answer: "",
            answerSources: [],
            askError: null,
            toolEvents: [],
            pendingApproval: null,
            sessionId: ask.sessionId,
            turnId: askedTurnId,
        });

        // Consume the "new conversation" flag if Clear was pressed
        // since the last ask. One-shot — the flag clears as soon as
        // it's read so subsequent asks continue the freshly-created
        // session.
        const newConversation = pendingNewConversationRef.current;
        pendingNewConversationRef.current = false;

        void askAgentStream({
            query: trimmed,
            teamId,
            accessToken,
            sessionId: ask.sessionId ?? undefined,
            threadContext,
            newConversation,
            // Web search makes no sense inside a thread Q&A; the backend
            // disables it anyway via the thread_context branch but
            // setting `allowWebSearch=false` keeps the wire payload
            // consistent with intent.
            allowWebSearch: false,
            signal: controller.signal,
            ...buildStreamHandlers(askedTurnId),
        });

        setQuery("");
    }, [
        query,
        teamId,
        accessToken,
        threadContext,
        buildStreamHandlers,
        ask.isStreaming,
        ask.pendingApproval,
        ask.turnId,
        ask.sessionId,
    ]);

    // ---- Cancel the in-flight answer. ----
    const onCancel = useCallback(() => {
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        setAsk((prev) => {
            if (!prev.isStreaming && prev.pendingApproval === null) return prev;
            const turnId = prev.turnId;
            if (!promotedTurnIdsRef.current.has(turnId)) {
                promotedTurnIdsRef.current.add(turnId);
                const hasContent =
                    Boolean(prev.answer) ||
                    prev.toolEvents.length > 0 ||
                    prev.answerSources.length > 0;
                if (hasContent) {
                    const snapshot: CompletedTurn = {
                        id: turnId,
                        askedQuery: prev.askedQuery,
                        answer: prev.answer,
                        answerSources: prev.answerSources,
                        toolEvents: prev.toolEvents,
                        askError: prev.askError,
                    };
                    setTurns((prevTurns) => {
                        const next = [...prevTurns, snapshot];
                        return next.length > MAX_TURNS
                            ? next.slice(next.length - MAX_TURNS)
                            : next;
                    });
                }
            }
            return { ...EMPTY_ASK_STATE, sessionId: prev.sessionId, turnId: prev.turnId };
        });
    }, []);

    // ---- Wipe the conversation but keep the summary + same thread. ----
    // Sets `pendingNewConversationRef` so the next /ask/ tells the
    // backend to start a fresh AgentSession rather than reusing the
    // existing per-thread one — without this, reloading the page would
    // restore the cleared turns via the thread-context lookup.
    const clearConversation = useCallback(() => {
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        promotedTurnIdsRef.current.clear();
        pendingNewConversationRef.current = true;
        setTurns([]);
        setAsk(EMPTY_ASK_STATE);
        setQuery("");
    }, []);

    // ---- Tear-down on unmount (thread switch). ----
    useEffect(() => {
        return () => {
            summaryAbortRef.current?.abort();
            askAbortRef.current?.abort();
        };
    }, []);

    return {
        isOpen,
        open,
        close,
        threadContext,
        summary,
        summaryLoading,
        summaryError,
        refreshSummary,
        staleSummary,
        query,
        setQuery,
        ask,
        turns,
        onAsk,
        onCancel,
        clearConversation,
    };
};
