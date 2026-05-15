// Spotlight overlay state + behavior:
//   - Cmd-K (mac) / Ctrl-K (others) toggles the overlay open.
//   - Escape closes it.
//   - Typing in the search input fires debounced searches against
//     /api/v2/search/. Results render live. AI is NOT invoked.
//   - Pressing Enter (or clicking the "Ask" button in the overlay)
//     calls `onAsk(query)` which streams an answer from
//     /api/v2/agent/ask. Phase 12: each completed turn is snapshotted
//     into `turns` so the overlay can render the conversation
//     history above the input row.
//
// Stale-response protection: each new query starts a fresh
// AbortController. When the user types fast we abort prior in-flight
// requests so older responses can never overwrite newer ones in the UI.
//
// Phase 12 invariants:
//   - Each ask gets a fresh monotonically-increasing `turnId`. Stream
//     handlers gate on `prev.turnId === askedTurnId` so a late event
//     from a superseded turn can't corrupt the current one. (The old
//     `askedQuery`-based gate failed when a user re-asked identical
//     text after an error.)
//   - On `onDone` or `onError` the current `ask` is *promoted* into
//     the `turns` array (idempotent via `promotedTurnIdsRef`) and
//     `ask` is reset to empty (preserving `sessionId` and `turnId`).
//   - `decide` does NOT bump `turnId` — approve/reject is a
//     continuation of the same turn, completed by the resumed stream.
//   - Closing the overlay preserves `{ sessionId, turns }` so an
//     accidental Escape doesn't lose the conversation. Only the
//     explicit "New conversation" button clears them.

import { useCallback, useEffect, useRef, useState } from "react";
import axios, { CanceledError } from "axios";

import {
    askAgentStream,
    decideAgent,
    fetchAgentUsage,
    type AgentUsage,
    type PendingApprovalPayload,
} from "../../services/agentApi";
import { searchSpotlight } from "../../services/searchApi";
import { isMac } from "../../utils/platform";
import type { SpotlightResult } from "./types";

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 20;
// Soft cap on how many completed turns we hold in client memory. The
// agent's own SESSION_MAX_PRIOR_TURNS (3 by default) controls how many
// the model actually sees; this cap is purely a UI memory bound.
const MAX_TURNS_IN_HISTORY = 20;
// localStorage persistence (Phase 17)
const STORAGE_KEY = (teamId: string) => `spotlight:session:v1:${teamId}`;
const STORAGE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_STORED_TURNS = 10; // lower cap than in-memory to limit storage size

export interface UseSpotlightArgs {
    accessToken: string | null;
    teamId: string | null | undefined;
}

export type ToolEventStatus = "pending" | "done" | "error";

export interface ToolEvent {
    step: number;
    tool_name: string;
    arguments: Record<string, unknown>;
    summary?: string;
    error?: string;
    status: ToolEventStatus;
}

export interface AskState {
    // True while either the search or the LLM stream is in flight.
    isStreaming: boolean;
    // The query the answer is for. May lag behind the input.
    askedQuery: string;
    // Accumulated answer text from the Gemini stream.
    answer: string;
    // Citation sources returned by the backend before the stream
    // started. We keep these separate from the `results` of
    // type-to-filter so the UI can show them attached to the answer.
    answerSources: SpotlightResult[];
    // Set when the stream emits an error event (or transport fails).
    askError: string | null;
    // Phase 3: per-step tool-call activity log. Ordered by step.
    toolEvents: ToolEvent[];
    // Phase 7: when the agent calls a write tool, the loop pauses
    // here. The UI renders an Approve / Reject card; clicking either
    // button calls `onApprove` / `onReject` and clears this field.
    pendingApproval: PendingApprovalPayload | null;
    // Phase 8: conversation session ID returned by the backend on the
    // `done` event. Sent back with subsequent /ask/ calls so the model
    // sees prior Q&A turns as context. Null means fresh session.
    sessionId: string | null;
    // Phase 12: monotonic id for the current in-flight turn. Stream
    // handlers gate on this rather than `askedQuery` so identical-text
    // re-asks don't bleed state across turns.
    turnId: number;
}

// Phase 12: an immutable snapshot of a finished turn. Past turns are
// promoted into the `turns` array; the live `ask` represents only the
// current in-flight turn (or an empty slot between turns).
export interface CompletedTurn {
    id: number;
    askedQuery: string;
    answer: string;
    answerSources: SpotlightResult[];
    toolEvents: ToolEvent[];
    askError: string | null;
}

export interface UseSpotlightReturn {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    query: string;
    setQuery: (q: string) => void;
    results: SpotlightResult[];
    isLoading: boolean;
    error: string | null;
    onAsk: (overrideQuery?: string) => void;
    onApprove: () => void;
    onReject: () => void;
    onCancel: () => void;
    onNewConversation: () => void;
    ask: AskState;
    turns: CompletedTurn[];
    dailyUsage: AgentUsage | null;
}

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

export const useSpotlight = ({ accessToken, teamId }: UseSpotlightArgs): UseSpotlightReturn => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SpotlightResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ask, setAsk] = useState<AskState>(EMPTY_ASK_STATE);
    const [turns, setTurns] = useState<CompletedTurn[]>([]);
    const [dailyUsage, setDailyUsage] = useState<AgentUsage | null>(null);

    // Used to abort in-flight searches when the query changes or the
    // overlay closes.
    const abortRef = useRef<AbortController | null>(null);
    // Separate abort handle for the Ask stream so a new search doesn't
    // cancel an in-progress answer.
    const askAbortRef = useRef<AbortController | null>(null);
    // Phase 12: tracks which turn ids have already been snapshotted
    // into `turns`. Makes the `onDone` / `onError` promote step
    // idempotent — whichever event arrives second is a no-op.
    const promotedTurnIdsRef = useRef<Set<number>>(new Set());
    // Read latest open state from inside the global keydown listener
    // without re-registering it on every render.
    const isOpenRef = useRef(isOpen);
    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);

    // ---- Global keyboard shortcut: Cmd-K / Ctrl-K toggles. ----
    useEffect(() => {
        const mac = isMac();

        const handleKeyDown = (e: KeyboardEvent) => {
            const isToggle = e.key.toLowerCase() === "k" && (mac ? e.metaKey : e.ctrlKey);
            if (isToggle) {
                // Don't fight system-level Cmd-K behaviors inside text
                // inputs that explicitly handle it (e.g. some editors),
                // but for the app shell this is what we want.
                e.preventDefault();
                setIsOpen((prev) => !prev);
                return;
            }
            if (e.key === "Escape" && isOpenRef.current) {
                e.preventDefault();
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

    // ---- Fetch daily usage from the backend when the overlay opens. ----
    // Re-fetches each open so the count is fresh after page navigations.
    // Silently no-ops on failure — the backend enforces the limit regardless.
    useEffect(() => {
        if (!isOpen || !accessToken) return;
        let cancelled = false;
        fetchAgentUsage(accessToken).then((usage) => {
            if (!cancelled) setDailyUsage(usage);
        });
        return () => {
            cancelled = true;
        };
    }, [isOpen, accessToken]);

    // ---- Hydrate conversation from localStorage on mount / team change. ----
    // Restores up to MAX_STORED_TURNS prior turns + sessionId so a page
    // reload doesn't lose the conversation context. TTL of 4 h prevents
    // stale history from reappearing the next morning. Any corrupt or
    // version-mismatched entry is silently discarded.
    useEffect(() => {
        if (!teamId) return;
        try {
            const raw = localStorage.getItem(STORAGE_KEY(teamId));
            if (!raw) return;
            const stored = JSON.parse(raw) as {
                version: number;
                savedAt: number;
                sessionId: string | null;
                turns: CompletedTurn[];
            };
            if (stored.version !== 1) return;
            if (Date.now() - stored.savedAt > STORAGE_TTL_MS) return;
            const restoredTurns = stored.turns ?? [];
            if (restoredTurns.length === 0 && !stored.sessionId) return;
            setTurns(restoredTurns);
            setAsk((prev) => ({ ...prev, sessionId: stored.sessionId ?? null }));
            // Seed promotedTurnIdsRef so stale handlers can't double-promote
            // a turn that was already snapshotted in a prior page session.
            restoredTurns.forEach((t) => promotedTurnIdsRef.current.add(t.id));
        } catch {
            // Ignore corrupt / missing localStorage entries.
        }
    }, [teamId]); // eslint-disable-line react-hooks/exhaustive-deps

    // ---- Overlay close: clear transient query / results, preserve
    // conversation. ----
    //
    // Phase 12 behavior change: a close (Escape, click-outside, Cmd-K
    // toggle) preserves `sessionId` and `turns` so the conversation
    // survives an accidental close. Only the explicit
    // "New conversation" button wipes them. Any in-flight stream is
    // still aborted — we don't want a background fetch to keep
    // mutating state after the user has dismissed the UI.
    useEffect(() => {
        if (isOpen) return;
        abortRef.current?.abort();
        abortRef.current = null;
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        setQuery("");
        setResults([]);
        setIsLoading(false);
        setError(null);
        // Clear streaming flag so re-opening doesn't show a stuck
        // spinner on a partial turn. Keep sessionId/turns/turnId so
        // the conversation can resume on re-open.
        setAsk((prev) => (prev.isStreaming ? { ...prev, isStreaming: false } : prev));
    }, [isOpen]);

    // ---- Persist conversation to localStorage on turns / sessionId change. ----
    // Debounced 500 ms so high-frequency answer_delta updates (which don't
    // change turns or sessionId) never trigger a write.
    // toolEvents are stripped before storing — they can contain large
    // argument blobs and are not needed for conversation resumption.
    useEffect(() => {
        if (!teamId) return;
        const timer = window.setTimeout(() => {
            try {
                const toStore = turns.slice(-MAX_STORED_TURNS).map((t) => ({
                    ...t,
                    toolEvents: [], // strip large blobs
                }));
                localStorage.setItem(
                    STORAGE_KEY(teamId),
                    JSON.stringify({
                        version: 1,
                        savedAt: Date.now(),
                        sessionId: ask.sessionId,
                        turns: toStore,
                    })
                );
            } catch {
                // Ignore quota errors silently — conversation still works in-memory.
            }
        }, 500);
        return () => window.clearTimeout(timer);
    }, [turns, ask.sessionId, teamId]);

    // ---- Debounced search on query change while overlay is open. ----
    useEffect(() => {
        if (!isOpen) return;
        const trimmed = query.trim();
        if (!trimmed) {
            // Empty query: clear out any previous results immediately.
            abortRef.current?.abort();
            abortRef.current = null;
            setResults([]);
            setIsLoading(false);
            setError(null);
            return;
        }
        if (!teamId) {
            setError("No team selected.");
            return;
        }

        // Start a fresh request; supersede any in-flight one.
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const timer = window.setTimeout(async () => {
            setIsLoading(true);
            setError(null);
            try {
                const data = await searchSpotlight({
                    query: trimmed,
                    team_id: teamId,
                    limit: RESULT_LIMIT,
                    use_vector: true,
                    accessToken,
                    signal: controller.signal,
                });
                // Drop the response if a newer request has already
                // started (defensive — abort *should* fire first, but
                // the timing window exists).
                if (controller.signal.aborted) return;
                setResults(data.results || []);
            } catch (err) {
                if (err instanceof CanceledError) return;
                if (axios.isCancel(err)) return;
                console.error("[Spotlight] search failed", err);
                setError("Search failed. Please try again.");
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }, DEBOUNCE_MS);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, isOpen, teamId, accessToken]);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    // ---- Promote the current `ask` into the `turns` history. ----
    //
    // Idempotent: the same `turnId` will only be promoted once even
    // if both `onDone` and `onError` fire (the runNdjsonStream
    // consumer doesn't stop on error). After promotion, the live
    // `ask` slot is reset to empty so the next `onAsk` starts clean,
    // preserving only `sessionId` (conversation continuity) and
    // `turnId` (so the next `onAsk` can bump it from a known base).
    const promoteCurrentTurn = useCallback((turnId: number) => {
        if (promotedTurnIdsRef.current.has(turnId)) return;
        promotedTurnIdsRef.current.add(turnId);
        setAsk((prev) => {
            // Defense: if a stale handler fires after a newer turn
            // has already replaced `ask`, leave `prev` alone.
            if (prev.turnId !== turnId) return prev;
            // Don't snapshot an empty turn — happens when an error
            // fires before any answer/tool/source content. Even an
            // empty error turn is worth showing though, so we promote
            // when `askError` is set.
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
                    return next.length > MAX_TURNS_IN_HISTORY
                        ? next.slice(next.length - MAX_TURNS_IN_HISTORY)
                        : next;
                });
            }
            return {
                ...EMPTY_ASK_STATE,
                sessionId: prev.sessionId,
                turnId: prev.turnId,
            };
        });
    }, []);

    // Builds the shared callback set used by both `askAgentStream`
    // (fresh /ask/) and `decideAgent` (resume). Both flows update the
    // same `ask` state, so the UI sees one continuous answer panel
    // even when a pause + resume happens in the middle.
    //
    // Phase 12: parameter is the turn id (monotonic int), not the
    // user's query text. `stillCurrent` now gates on identity rather
    // than string equality, so re-asking the same query never crosses
    // wires.
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
                        // If the same (step, tool_name) is already in
                        // the list as `pending` it's the resume call
                        // re-announcing the previously-paused tool —
                        // don't duplicate the row.
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
                              }
                            : prev
                    );
                },
            };
        },
        [promoteCurrentTurn]
    );

    // ---- Enter / Ask button handler: stream the agent's answer. ----
    // `overrideQuery` is supplied by the retry button on past turns so
    // it can bypass the query input state without a render cycle.
    const onAsk = useCallback(
        (overrideQuery?: string) => {
            const trimmed = (overrideQuery !== undefined ? overrideQuery : query).trim();
            if (!trimmed) return;
            // Defense: never start a new ask while the previous one is
            // still streaming or awaiting approval. The UI also disables
            // the Ask button + Enter in these states.
            if (ask.isStreaming || ask.pendingApproval !== null) return;
            if (!teamId) {
                setAsk({
                    ...EMPTY_ASK_STATE,
                    sessionId: ask.sessionId,
                    turnId: ask.turnId + 1,
                    askedQuery: trimmed,
                    askError: "No team selected.",
                });
                return;
            }

            // Cancel any prior in-flight Ask before starting a new one.
            askAbortRef.current?.abort();
            const controller = new AbortController();
            askAbortRef.current = controller;

            // Read turnId and sessionId directly from the current `ask`
            // value — NOT from inside a setAsk updater. In React 18,
            // updater functions run during the commit phase (after the
            // synchronous event handler returns), so any variable assigned
            // inside the updater is still at its initial value when the
            // code below runs. If askedTurnId stayed 0 here while the
            // state update set turnId:1, every `stillCurrent` check in the
            // stream handlers would return false and all events would be
            // silently dropped, leaving `isStreaming` stuck at true forever.
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

            void askAgentStream({
                query: trimmed,
                teamId,
                accessToken,
                sessionId: ask.sessionId ?? undefined,
                signal: controller.signal,
                ...buildStreamHandlers(askedTurnId),
            });

            // Optimistically increment the local usage counter so the UI
            // reflects the new count without waiting for the next /usage/ fetch.
            // The backend is the authoritative gate; this is display-only.
            setDailyUsage((prev) => (prev ? { ...prev, used: prev.used + 1 } : prev));

            // Clear the input immediately after submitting. The question is
            // already captured in `ask.askedQuery` and visible in the
            // conversation history, so the input is ready for the next one.
            setQuery("");
        },
        [
            query,
            teamId,
            accessToken,
            buildStreamHandlers,
            ask.isStreaming,
            ask.pendingApproval,
            ask.turnId,
            ask.sessionId,
        ]
    );

    // ---- Approve / Reject handlers for the pending write tool. ----
    //
    // Note: `decide` does NOT bump `turnId`. Approve/reject is a
    // continuation of the same turn — the resumed stream's `onDone`
    // is what promotes the now-completed turn into history.
    const decide = useCallback(
        (decision: "approve" | "reject") => {
            setAsk((prev) => {
                if (!prev.pendingApproval) return prev;
                const payload = prev.pendingApproval;
                const askedTurnId = prev.turnId;

                // Mark the pending tool's row as transitioning. The
                // resume stream will fire tool_call_start (deduped via
                // buildStreamHandlers) followed by result/error to fill
                // it in properly.
                const next: AskState = {
                    ...prev,
                    pendingApproval: null,
                    isStreaming: true,
                };

                // Reuse the same abort controller bucket; new request
                // supersedes anything older.
                askAbortRef.current?.abort();
                const controller = new AbortController();
                askAbortRef.current = controller;

                void decideAgent({
                    runId: payload.run_id,
                    approvalToken: payload.approval_token,
                    decision,
                    accessToken,
                    signal: controller.signal,
                    ...buildStreamHandlers(askedTurnId),
                });

                return next;
            });
        },
        [accessToken, buildStreamHandlers]
    );

    const onApprove = useCallback(() => decide("approve"), [decide]);
    const onReject = useCallback(() => decide("reject"), [decide]);

    // ---- Cancel: stop the in-flight stream and clean up. ----
    //
    // Aborting the fetch throws AbortError which is silently swallowed
    // by `runNdjsonStream` — it returns without calling any handler.
    // So we must manually promote (or discard) the partial turn here,
    // otherwise `ask.isStreaming` would stay true forever.
    const onCancel = useCallback(() => {
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        setAsk((prev) => {
            if (!prev.isStreaming && prev.pendingApproval === null) return prev;
            const turnId = prev.turnId;
            if (!promotedTurnIdsRef.current.has(turnId)) {
                promotedTurnIdsRef.current.add(turnId);
                // Keep whatever partial content arrived before cancel.
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
                        return next.length > MAX_TURNS_IN_HISTORY
                            ? next.slice(next.length - MAX_TURNS_IN_HISTORY)
                            : next;
                    });
                }
            }
            return { ...EMPTY_ASK_STATE, sessionId: prev.sessionId, turnId: prev.turnId };
        });
    }, []);

    // ---- New Conversation: clears the session AND prior turns so
    // the next ask starts fresh with no prior-turn context injected. ----
    const onNewConversation = useCallback(() => {
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        promotedTurnIdsRef.current.clear();
        setTurns([]);
        setAsk(EMPTY_ASK_STATE);
        // Wipe persisted state immediately so a reload after "New conversation"
        // opens a blank overlay rather than restoring the cleared history.
        if (teamId) {
            try {
                localStorage.removeItem(STORAGE_KEY(teamId));
            } catch {
                /* ignore */
            }
        }
    }, [teamId]);

    return {
        isOpen,
        open,
        close,
        query,
        setQuery,
        results,
        isLoading,
        error,
        onAsk,
        onApprove,
        onReject,
        onCancel,
        onNewConversation,
        ask,
        turns,
        dailyUsage,
    };
};
