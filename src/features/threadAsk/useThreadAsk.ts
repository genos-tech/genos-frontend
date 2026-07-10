// useThreadAsk — state + behavior for the "Ask about this thread" modal
// launched from ThreadChatPaneHeader.
//
// Thin orchestrator over `useAgentQA` (which owns turns, ask state,
// streaming, approval, etc.) + thread-specific concerns:
//   1. **Summary** — on open, fetch `/agent/thread-summary/`. The
//      backend returns either a cached row (no LLM cost) or generates
//      a fresh summary. We display it and start a 30 s background poll
//      that re-fetches the fingerprint. If the fingerprint drifts (new
//      messages, edit, delete), set `staleSummary=true` so the UI can
//      surface a "Refresh summary?" banner.
//   2. **Q&A** — delegated to `useAgentQA`. We inject `threadContext`
//      (and the user's web-search preference) via `buildAskExtras` so
//      the backend scopes the agent to this thread.
//   3. **Bootstrap from session** — the summary endpoint also returns
//      this user's per-thread `agent_session_id` and prior turns. We
//      apply those to `useAgentQA` via `reset` so the modal hydrates
//      with the conversation history.

import { useCallback, useEffect, useRef, useState } from "react";

import {
    fetchThreadSummary,
    type AgentSessionTurn,
    type ThreadContext,
    type ThreadSummaryResponse,
} from "../../services/agentApi";
import { useAgentQA, type CompletedTurn, type ToolEvent, type UseAgentQAReturn } from "../agentQA";

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
    // Carry run_id so restored turns can still be rated (F1).
    runId: turn.run_id,
});

// How often we re-check the server's fingerprint while the modal is
// open. 30 s is a generous compromise — the backend call is cheap
// (peek-only, no LLM) and even a multi-team thread doesn't churn faster.
const FINGERPRINT_POLL_MS = 30_000;

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

// Merged shape returned by `useThreadAsk`. The thread-specific summary
// controls live at the top level; the generic Q&A state machine is
// exposed under `agentQA` so the modal can pass it straight into
// `<AgentQAConversation state={state.agentQA} />` /
// `<AgentQAInput state={state.agentQA} />`.
export interface UseThreadAskReturn {
    // ---- Open / close ----
    isOpen: boolean;
    // `prefillQuery` pre-fills the ask input (without sending) — used by
    // action-flavored entry points like "Plan tasks from this thread" so
    // the user can name the target project / adjust scope before sending.
    open: (threadContext: ThreadContext, opts?: { prefillQuery?: string }) => void;
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

    // ---- Q&A (generic; delegated to useAgentQA) ----
    agentQA: UseAgentQAReturn;
}

export const useThreadAsk = ({ accessToken, teamId }: UseThreadAskArgs): UseThreadAskReturn => {
    // Web search follows the same per-user Spotlight toggle as everywhere
    // else, but the gate is server-side (the backend reads the persisted
    // preference) — no per-request flag to send from here.
    const [isOpen, setIsOpen] = useState(false);
    const [threadContext, setThreadContext] = useState<ThreadContext | null>(null);

    const [summary, setSummary] = useState<ThreadSummaryState | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [staleSummary, setStaleSummary] = useState(false);

    // Aborts: the agentQA hook owns the ask-stream abort; here we only
    // track the summary fetch so a force-refresh or a switch-away can
    // cancel an in-flight summary load.
    const summaryAbortRef = useRef<AbortController | null>(null);

    // Threading the latest threadContext through callbacks via a ref
    // keeps `buildAskExtras` and the polling effect stable across
    // re-renders without rebuilding when only the context changes.
    const threadContextRef = useRef<ThreadContext | null>(threadContext);
    useEffect(() => {
        threadContextRef.current = threadContext;
    }, [threadContext]);

    // The generic Q&A hook. Its `buildAskExtras` is called fresh on
    // every onAsk(), so reads via threadContextRef pick up the latest
    // context without invalidating the closure.
    const agentQA = useAgentQA({
        accessToken,
        teamId,
        buildAskExtras: useCallback(
            () => ({
                threadContext: threadContextRef.current ?? undefined,
            }),
            []
        ),
    });

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
                    // Hydrate the agentQA hook from the server snapshot
                    // — but ONLY when the server actually has state to
                    // restore. A blank snapshot on a stale-session race
                    // would otherwise wipe in-progress local turns; the
                    // pre-refactor code carefully gated this on either
                    // `turns.length > 0` or `agent_session_id` truthy.
                    // Open() handles the genuine "clear everything"
                    // case for thread switches; here we only restore.
                    const restored: CompletedTurn[] = (data.turns || []).map(
                        sessionTurnToCompleted
                    );
                    if (restored.length > 0 || data.agent_session_id) {
                        agentQA.reset({
                            sessionId: data.agent_session_id,
                            turns: restored,
                        });
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
        [accessToken, teamId, agentQA]
    );

    const open = useCallback(
        (ctx: ThreadContext, opts?: { prefillQuery?: string }) => {
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
                // Full wipe before loadSummary populates with server state.
                agentQA.reset({ sessionId: null, turns: [] });
                agentQA.setQuery(opts?.prefillQuery ?? "");
                loadSummary(ctx, false);
            } else {
                if (!summary && !summaryLoading) {
                    // Same thread but no summary yet (e.g. previous load
                    // failed and we're reopening). Re-attempt.
                    loadSummary(ctx, false);
                }
                // An action entry point ("Plan tasks…") re-opening the
                // same thread still wants its prepared query in the box.
                if (opts?.prefillQuery) {
                    agentQA.setQuery(opts.prefillQuery);
                }
            }
        },
        [threadContext, summary, summaryLoading, loadSummary, agentQA]
    );

    const close = useCallback(() => {
        setIsOpen(false);
        // Abort an in-flight summary fetch; the agentQA hook handles
        // its own in-flight stream — we leave it alone, preserving the
        // partial answer if the user reopens.
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

    // ---- Tear-down on unmount (thread switch). ----
    useEffect(() => {
        return () => {
            summaryAbortRef.current?.abort();
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
        agentQA,
    };
};

// Re-export so wrappers (or the modal) that need the underlying agentQA
// return shape — e.g. to pass into AgentQAConversation — can read it.
export type { ToolEvent, UseAgentQAReturn };
