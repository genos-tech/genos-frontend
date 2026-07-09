// useNoteAsk — state + behavior for the "Ask about this note" modal
// launched from NoteHeaderActions.
//
// Thin orchestrator over `useAgentQA` (which owns turns, ask state,
// streaming, approval, etc.) + note-specific concerns:
//   1. **Summary** — on open, fetch `/agent/note-summary/`. The
//      backend returns either a cached row (no LLM cost) or generates
//      a fresh summary. We display it and start a 30 s background poll
//      that re-fetches the fingerprint. If the fingerprint drifts
//      (body or title edit), set `staleSummary=true`.
//   2. **Q&A** — delegated to `useAgentQA`. We inject `noteContext`
//      (and the user's web-search preference) via `buildAskExtras` so
//      the backend scopes the agent to this note.
//   3. **Bootstrap from session** — the summary endpoint also returns
//      this user's per-note `agent_session_id` and prior turns. We
//      apply those to `useAgentQA` via `reset` so the modal hydrates
//      with the conversation history.

import { useCallback, useEffect, useRef, useState } from "react";

import {
    fetchNoteSummary,
    type AgentSessionTurn,
    type NoteContext,
    type NoteSummaryResponse,
} from "../../services/agentApi";
import { useAgentQA, type CompletedTurn, type UseAgentQAReturn } from "../agentQA";

// Map a server-side AgentSessionTurn to the local CompletedTurn shape.
// Same shape as the thread variant — both share the same backend session
// model under the hood.
const sessionTurnToCompleted = (turn: AgentSessionTurn, index: number): CompletedTurn => ({
    id: index + 1,
    askedQuery: turn.query,
    answer: turn.answer,
    answerSources: turn.sources || [],
    toolEvents: [],
    askError: turn.error || null,
    // Carry run_id so restored turns can still be rated (F1).
    runId: turn.run_id,
});

// How often we re-check the server's fingerprint while the modal is
// open. Notes don't change as often as threads, but the same 30 s
// cadence keeps the UX consistent across the two surfaces.
const FINGERPRINT_POLL_MS = 30_000;

export interface UseNoteAskArgs {
    accessToken: string | null;
    teamId: string | null | undefined;
}

export interface NoteSummaryState {
    text: string;
    lastUpdatedIso: string;
    fingerprint: string;
    bodyLength: number;
    noteTitle: string;
}

export interface UseNoteAskReturn {
    // ---- Open / close ----
    isOpen: boolean;
    open: (noteContext: NoteContext) => void;
    close: () => void;

    // The note the modal is currently bound to. Null when the user
    // hasn't opened it yet.
    noteContext: NoteContext | null;

    // ---- Summary ----
    summary: NoteSummaryState | null;
    summaryLoading: boolean;
    summaryError: string | null;
    refreshSummary: () => void;
    // True when the background fingerprint poll detected drift since
    // the displayed summary. UI shows a "note updated — refresh?" banner.
    staleSummary: boolean;

    // ---- Q&A (generic; delegated to useAgentQA) ----
    agentQA: UseAgentQAReturn;
}

export const useNoteAsk = ({ accessToken, teamId }: UseNoteAskArgs): UseNoteAskReturn => {
    // Web search follows the same per-user Spotlight toggle as the thread
    // variant, but the gate is server-side (the backend reads the
    // persisted preference) — no per-request flag to send from here.
    const [isOpen, setIsOpen] = useState(false);
    const [noteContext, setNoteContext] = useState<NoteContext | null>(null);

    const [summary, setSummary] = useState<NoteSummaryState | null>(null);
    const [summaryLoading, setSummaryLoading] = useState(false);
    const [summaryError, setSummaryError] = useState<string | null>(null);
    const [staleSummary, setStaleSummary] = useState(false);

    // Abort handle for the in-flight summary fetch. agentQA owns its
    // own ask-stream abort.
    const summaryAbortRef = useRef<AbortController | null>(null);

    // Stable reference to the latest noteContext for callbacks (matches
    // the pattern used in useThreadAsk).
    const noteContextRef = useRef<NoteContext | null>(noteContext);
    useEffect(() => {
        noteContextRef.current = noteContext;
    }, [noteContext]);

    // The generic Q&A hook. `buildAskExtras` is called fresh on every
    // onAsk(), so reads via noteContextRef pick up the latest value
    // without invalidating the closure.
    const agentQA = useAgentQA({
        accessToken,
        teamId,
        buildAskExtras: useCallback(
            () => ({
                noteContext: noteContextRef.current ?? undefined,
            }),
            []
        ),
    });

    // ---- Load / refresh the summary. ----
    const loadSummary = useCallback(
        (ctx: NoteContext, force: boolean) => {
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
                    const data: NoteSummaryResponse = await fetchNoteSummary({
                        accessToken,
                        teamId,
                        noteContext: ctx,
                        forceRegenerate: force,
                        signal: controller.signal,
                    });
                    if (controller.signal.aborted) return;
                    setSummary({
                        text: data.summary,
                        lastUpdatedIso: data.last_updated_iso,
                        fingerprint: data.fingerprint,
                        bodyLength: data.body_length,
                        noteTitle: data.note_title,
                    });
                    // Hydrate the agentQA hook from the server snapshot
                    // ONLY when the server actually has state to
                    // restore. A blank snapshot would otherwise wipe
                    // in-progress local turns (matches the threadAsk
                    // pattern; open() handles the genuine clear-on-
                    // switch case).
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
        (ctx: NoteContext) => {
            setIsOpen(true);
            // Switching to a different note tears down the existing
            // conversation: a Q&A about note A makes no sense for note B.
            const sameNote =
                noteContext !== null &&
                noteContext.noteType === ctx.noteType &&
                noteContext.noteId === ctx.noteId;
            if (!sameNote) {
                setNoteContext(ctx);
                setSummary(null);
                setStaleSummary(false);
                // Full wipe before loadSummary populates with server state.
                agentQA.reset({ sessionId: null, turns: [] });
                agentQA.setQuery("");
                loadSummary(ctx, false);
            } else if (!summary && !summaryLoading) {
                // Same note but no summary yet (previous load failed
                // and we're reopening). Re-attempt.
                loadSummary(ctx, false);
            }
        },
        [noteContext, summary, summaryLoading, loadSummary, agentQA]
    );

    const close = useCallback(() => {
        setIsOpen(false);
        summaryAbortRef.current?.abort();
        summaryAbortRef.current = null;
    }, []);

    const refreshSummary = useCallback(() => {
        if (!noteContext) return;
        // Don't force-regenerate. The shared-cache design means another
        // user with ACL access may have already refreshed it after the
        // edit — in that case we want the cached row, not another LLM
        // call. The backend's fingerprint check decides.
        loadSummary(noteContext, false);
    }, [noteContext, loadSummary]);

    // ---- Background fingerprint polling: detect note edits while open. ----
    useEffect(() => {
        if (!isOpen || !noteContext || !accessToken || !teamId) return;
        if (!summary) return;
        const displayedFingerprint = summary.fingerprint;
        let cancelled = false;
        const interval = window.setInterval(async () => {
            try {
                const data = await fetchNoteSummary({
                    accessToken,
                    teamId,
                    noteContext,
                    forceRegenerate: false,
                });
                if (cancelled) return;
                if (data.fingerprint !== displayedFingerprint) {
                    // Different fingerprint = note evolved. The server's
                    // response may still be a cache hit matching the
                    // *new* state, so we only flag stale — we don't
                    // auto-replace the displayed summary.
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
    }, [isOpen, noteContext, accessToken, teamId, summary]);

    // ---- Tear-down on unmount. ----
    useEffect(() => {
        return () => {
            summaryAbortRef.current?.abort();
        };
    }, []);

    return {
        isOpen,
        open,
        close,
        noteContext,
        summary,
        summaryLoading,
        summaryError,
        refreshSummary,
        staleSummary,
        agentQA,
    };
};
