// Spotlight overlay state + behavior:
//   - Cmd-K (mac) / Ctrl-K (others) toggles the overlay open.
//   - Escape closes it.
//   - Typing in the search input fires debounced searches against
//     /api/v2/search/. Results render live. AI is NOT invoked.
//   - Pressing Enter (or clicking the "Ask" button in the overlay)
//     calls `onAsk(query)` — Phase 1 stub: logs + does nothing.
//     Phase 2 will swap this for a call to /api/v2/agent/ask.
//
// Stale-response protection: each new query starts a fresh
// AbortController. When the user types fast we abort prior in-flight
// requests so older responses can never overwrite newer ones in the UI.

import { useCallback, useEffect, useRef, useState } from "react";
import axios, { CanceledError } from "axios";

import { askAgentStream, decideAgent, type PendingApprovalPayload } from "../../services/agentApi";
import { searchSpotlight } from "../../services/searchApi";
import { isMac } from "../../utils/platform";
import type { SpotlightResult } from "./types";

const DEBOUNCE_MS = 250;
const RESULT_LIMIT = 20;

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
    onAsk: () => void;
    onApprove: () => void;
    onReject: () => void;
    onNewConversation: () => void;
    ask: AskState;
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
};

export const useSpotlight = ({ accessToken, teamId }: UseSpotlightArgs): UseSpotlightReturn => {
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SpotlightResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [ask, setAsk] = useState<AskState>(EMPTY_ASK_STATE);

    // Used to abort in-flight searches when the query changes or the
    // overlay closes.
    const abortRef = useRef<AbortController | null>(null);
    // Separate abort handle for the Ask stream so a new search doesn't
    // cancel an in-progress answer.
    const askAbortRef = useRef<AbortController | null>(null);
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

    // ---- Reset transient state whenever the overlay closes. ----
    useEffect(() => {
        if (isOpen) return;
        // On close: cancel any pending request and clear state so the
        // next open starts fresh (no flash of the previous query's
        // results when re-opening).
        abortRef.current?.abort();
        abortRef.current = null;
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        setQuery("");
        setResults([]);
        setIsLoading(false);
        setError(null);
        setAsk(EMPTY_ASK_STATE);
    }, [isOpen]);

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

    // Builds the shared callback set used by both `askAgentStream`
    // (fresh /ask/) and `decideAgent` (resume). Both flows update the
    // same `ask` state, so the UI sees one continuous answer panel
    // even when a pause + resume happens in the middle.
    const buildStreamHandlers = useCallback(
        (askedQuery: string) => {
            const stillCurrent = (prev: AskState) => prev.askedQuery === askedQuery;
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
                },
                onError: (message: string) => {
                    setAsk((prev) =>
                        stillCurrent(prev)
                            ? { ...prev, isStreaming: false, askError: message }
                            : prev
                    );
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
        // setAsk is stable (React state setter); no dep needed.
        []
    );

    // ---- Enter / Ask button handler: stream the agent's answer. ----
    const onAsk = useCallback(() => {
        const trimmed = query.trim();
        if (!trimmed) return;
        if (!teamId) {
            setAsk({
                ...EMPTY_ASK_STATE,
                askedQuery: trimmed,
                askError: "No team selected.",
            });
            return;
        }

        // Cancel any prior in-flight Ask before starting a new one.
        askAbortRef.current?.abort();
        const controller = new AbortController();
        askAbortRef.current = controller;

        // Preserve sessionId across turns so the backend can thread
        // conversation history. Reset everything else.
        setAsk((prev) => ({
            isStreaming: true,
            askedQuery: trimmed,
            answer: "",
            answerSources: [],
            askError: null,
            toolEvents: [],
            pendingApproval: null,
            sessionId: prev.sessionId,
        }));

        void askAgentStream({
            query: trimmed,
            teamId,
            accessToken,
            sessionId: ask.sessionId ?? undefined,
            signal: controller.signal,
            ...buildStreamHandlers(trimmed),
        });
    }, [query, teamId, accessToken, buildStreamHandlers, ask.sessionId]);

    // ---- Approve / Reject handlers for the pending write tool. ----
    const decide = useCallback(
        (decision: "approve" | "reject") => {
            setAsk((prev) => {
                if (!prev.pendingApproval) return prev;
                const payload = prev.pendingApproval;
                const askedQuery = prev.askedQuery;

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
                    ...buildStreamHandlers(askedQuery),
                });

                return next;
            });
        },
        [accessToken, buildStreamHandlers]
    );

    const onApprove = useCallback(() => decide("approve"), [decide]);
    const onReject = useCallback(() => decide("reject"), [decide]);

    // ---- New Conversation: clears the session so the next ask starts
    // fresh with no prior-turn context injected. ----
    const onNewConversation = useCallback(() => {
        askAbortRef.current?.abort();
        askAbortRef.current = null;
        setAsk(EMPTY_ASK_STATE);
    }, []);

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
        onNewConversation,
        ask,
    };
};
