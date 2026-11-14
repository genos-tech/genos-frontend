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
// This hook is a thin wrapper. The ask/answer state machine (turn ids, the
// live `ask` slot, promotion into `turns`, approve/reject, cancel, stream
// handlers) is `useAgentQA` — the same machine the thread and note asks
// run on, so there is exactly one of it. What stays here is Spotlight's
// own: the combined search+ask input and typeahead, filters, the History
// panel and Genos-page sessions, localStorage persistence of the
// conversation, the AI-answers setting, the demo funnel and the
// open/close state of the overlay.
//
// Conversation invariants (enforced by `useAgentQA`):
//   - Each ask gets a fresh monotonically-increasing `turnId`; a late
//     event from a superseded turn can't corrupt the current one.
//   - On done / error the live `ask` is *promoted* into `turns` once.
//   - Approve/reject does NOT bump `turnId` — it continues the same turn.
//   - Closing the overlay preserves `{ sessionId, turns }` so an
//     accidental Escape doesn't lose the conversation. Only the
//     explicit "New conversation" button clears them. The unsent draft
//     `query` survives a close too — see the close effect.
//
// Page mode (Genos main page): the same hook instance also drives the
// full-page surface at /workspace/genos. `isPageActive` marks that the
// page is showing, which (a) keeps the search pipeline live and the
// transient query/filter state intact while the overlay is closed, and
// (b) reroutes Cmd-K to focus the page's input (via
// `registerPageInputFocus`) instead of opening a redundant overlay.
// `resumeSession` restores a past session from the server archive into
// the live conversation so follow-up asks continue it server-side.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios, { CanceledError } from "axios";

import { useSpotlightPreferences } from "../../hooks/common/useSpotlightPreferences";
import { useTranslation } from "../../i18n";
import {
    fetchAgentSessionDetail,
    fetchAgentSessions,
    type AgentSessionDetail,
    type AgentSessionSummary,
} from "../../services/agentApi";
import { markDemoCompleted } from "../../services/demoFunnel";
import {
    isRunBeingWatched,
    notifyAgentRunComplete,
} from "../../services/notifications/agentRunNotice";
import type { NotificationManager } from "../../services/notifications/notificationManager";
import { searchSpotlight } from "../../services/searchApi";
import { useShortcut } from "../../shortcuts";
import {
    deletionCoversSession,
    MAX_TURNS_IN_HISTORY,
    sessionTurnToCompleted,
    useAgentSessionsDeleted,
    type AgentMentionRef,
    type AgentRunResult,
    type AskState,
    type CompletedTurn,
    type ToolEvent,
    type UndoRequest,
} from "../agentQA";
import { useAgentQA } from "../agentQA/useAgentQA";
import { lookupTaskByDisplayId } from "../tasks/services/lookupTaskByDisplayId";
import { displayIdOnlyQuery } from "../tasks/utils/taskDisplayId";
import { askGenosToken, onAskGenosAbout, withAskGenosToken } from "./askGenosAbout";
import { idHitPassesFilter, spotlightResultForTask, withIdHit } from "./displayIdHit";
import {
    effectiveFilterServices,
    entityTypesForFilter,
    projectIdsForFilter,
    toggleFilterService,
    type SpotlightFilterService,
} from "./spotlightFilters";
import type { SpotlightResult } from "./types";

// Re-exported so existing consumers that import these types from
// `features/spotlight/useSpotlight` continue to compile while the
// agentQA package becomes the canonical home.
export type { AskState, CompletedTurn, ToolEvent };

// Search debounce on query changes. Deliberately generous (was 250):
// smooth typing beats fast results (product call, 2026-07-11) — with
// the overlay's own 150 ms write debounce the typing→results floor is
// ~550 ms, and fewer mid-typing result landings means fewer App-level
// re-renders while the user is still composing.
const DEBOUNCE_MS = 400;
const RESULT_LIMIT = 20;
// Typeahead relevance thresholds passed explicitly to the search view so
// the *relative* floor drives result cutoff, not the absolute one.
//
// Background: the backend's default absolute floor (min_score ≈ 0.040) was
// calibrated for the agent/eval path. Real typeahead RRF scores land well
// below it (freshness decay + typeahead chunk-type demotion push top hits
// into the ~0.02–0.045 band), so nothing cleared the floor and the
// backend's "always return at least N" guard collapsed every query to a
// fixed 3 results. Passing a near-zero absolute floor lets the relative
// floor (RESULT_MIN_SCORE_RATIO × top score) govern instead: it adapts
// per query and returns *all* results within ~half the top hit's
// confidence — the "show every highly-relevant hit" behaviour we want —
// while still self-suppressing gibberish (no strong top hit → tiny floor
// → few/no results). A small non-zero absolute floor stays as a backstop
// against deep single-lane vector noise.
const RESULT_MIN_SCORE_RATIO = 0.5;
const RESULT_MIN_SCORE = 0.01;
// localStorage persistence (Phase 17)
const STORAGE_KEY = (teamId: string) => `spotlight:session:v1:${teamId}`;
const STORAGE_TTL_MS = 4 * 60 * 60 * 1000; // 4 hours
const MAX_STORED_TURNS = 10; // lower cap than in-memory to limit storage size

/**
 * Where an ask came from. Passed explicitly rather than inferred from
 * `overrideQuery !== undefined`, which cannot tell a starter chip from a
 * retry button — both supply one. Shape only: no question text travels with
 * it (see `services/demoFunnel`).
 */
export type SpotlightAskOrigin = "typed" | "starter" | "retry";

// `origin` travels through `useAgentQA` as the ask's opaque `meta` and comes
// back on `AgentRunResult.meta`; this is the narrowing on the way out.
const askOriginOf = (meta: unknown): SpotlightAskOrigin => {
    const origin = (meta as { origin?: SpotlightAskOrigin } | null | undefined)?.origin;
    return origin === "starter" || origin === "retry" ? origin : "typed";
};

export interface UseSpotlightArgs {
    accessToken: string | null;
    teamId: string | null | undefined;
    // Passed in rather than read from `useNotificationsContext` because
    // this hook is called at the App root, ABOVE the provider that would
    // supply it. Optional so the Spotlight tests (and any consumer that
    // doesn't care) can leave it out — the notice is then skipped.
    notificationManager?: NotificationManager | null;
    // True while the full-page Genos surface (/workspace/genos) is the
    // active route. The page renders the same SpotlightContent this
    // hook drives, so while it's showing: the search pipeline stays
    // live with the overlay closed, transient query/filter state is
    // NOT wiped, and Cmd-K focuses the page input instead of opening
    // the overlay. Optional so existing consumers/tests are unchanged.
    isPageActive?: boolean;
}

// History feature (Phase ~4.6): read-only archive of past agent
// conversations. State machine:
//   "closed"  → list/detail not shown; conversation panel renders normally
//   "list"    → list of recent sessions replaces the conversation panel
//   "detail"  → one past session's full Q&A renders read-only
// Closed is the default; the user opens via the clock icon in the
// conversation header.
export type HistoryMode = "closed" | "list" | "detail";

export interface UseSpotlightReturn {
    isOpen: boolean;
    open: () => void;
    close: () => void;
    query: string;
    setQuery: (q: string) => void;
    results: SpotlightResult[];
    isLoading: boolean;
    error: string | null;
    // ----- Search-mode service filter (chips under the input box) -----
    // Empty = no filter (backend default: everything). Toggling while
    // results are on screen re-runs the search immediately (no typing
    // debounce). Reset when the overlay closes.
    filterServices: SpotlightFilterService[];
    onToggleFilterService: (service: SpotlightFilterService) => void;
    // ----- Search-mode project filter (dropdown in the same row) -----
    // Empty = no project scoping. Unlike the service chips this is a
    // multi-select over the team's project list, so the overlay hands
    // back the whole selection rather than a single toggled item.
    // Re-runs the search immediately and resets on close, exactly like
    // `filterServices`.
    filterProjectIds: number[];
    onChangeFilterProjects: (projectIds: number[]) => void;
    // `origin` is analytics-only and optional — every existing caller keeps
    // working and lands in the "typed" default.
    onAsk: (
        overrideQuery?: string,
        mentions?: AgentMentionRef[],
        origin?: SpotlightAskOrigin
    ) => void;
    onApprove: (editedArgs?: Record<string, unknown>) => void;
    onReject: (reason?: string) => void;
    // Undo one approved write: the shared machine's `undoStep`. The step's state
    // lives in the undo store, so the overlay and the Genos page agree.
    undoStep: (request: UndoRequest) => void;
    onCancel: () => void;
    onNewConversation: () => void;
    // Render a collected past answer (a "spotlight_answer" search result)
    // inline in the overlay, reusing the live-answer renderer. No network call.
    showStoredAnswer: (result: SpotlightResult) => void;
    ask: AskState;
    turns: CompletedTurn[];
    // Mirror of the AI-answers preference. The overlay reads this to
    // disable the Ask button and the Enter handler when the user has
    // turned the LLM path off in Settings.
    aiAnswersEnabled: boolean;
    // ----- History panel -----
    historyMode: HistoryMode;
    historySessions: AgentSessionSummary[];
    historyDetail: AgentSessionDetail | null;
    historyIsLoading: boolean;
    // The last attempt to load the list FAILED. Not the same as an empty
    // list: with rows already showing they are kept, with none the panel says
    // it couldn't load and calls `openHistory` again to retry.
    historyLoadFailed: boolean;
    openHistory: () => void;
    viewHistorySession: (sessionId: string) => void;
    backToHistoryList: () => void;
    closeHistory: () => void;
    // F1 — persist a 👍/👎 rating for a finished turn (keyed by run_id).
    submitFeedback: (runId: string, rating: number) => void;
    // ----- Genos page (page mode) -----
    // Restore a past session from the server archive into the LIVE
    // conversation: transcript replaces `turns`, `sessionId` continues
    // the session server-side (the next ask sends `resume: true` so an
    // idle-expired session is reused rather than silently forked).
    resumeSession: (sessionId: string) => void;
    resumeIsLoading: boolean;
    // Non-null after a failed resume (session outside retention → 404,
    // network error). The current conversation is left intact; cleared
    // on the next resume attempt or "New conversation".
    resumeError: string | null;
    // The Genos page registers its input-focus function here so Cmd-K
    // focuses the page input while the page is active (instead of
    // opening the overlay). Pass null on unmount.
    registerPageInputFocus: (fn: (() => void) | null) => void;
}

export const useSpotlight = ({
    accessToken,
    teamId,
    notificationManager,
    isPageActive = false,
}: UseSpotlightArgs): UseSpotlightReturn => {
    const { t } = useTranslation();
    const [isOpen, setIsOpen] = useState(false);
    const [query, setQuery] = useState("");
    const [results, setResults] = useState<SpotlightResult[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    // Service filter chips (search mode only). Empty = all services.
    const [filterServices, setFilterServices] = useState<SpotlightFilterService[]>([]);
    // Project filter (search mode only). Empty = every project.
    const [filterProjectIds, setFilterProjectIds] = useState<number[]>([]);
    // ----- History panel state (Phase ~4.6) -----
    // historyMode flips the conversation panel into a read-only archive
    // view. historySessions is the list, historyDetail is the selected
    // session's full Q&A. isLoading covers both fetches so the UI can
    // show one spinner.
    const [historyMode, setHistoryMode] = useState<HistoryMode>("closed");
    const [historySessions, setHistorySessions] = useState<AgentSessionSummary[]>([]);
    const [historyDetail, setHistoryDetail] = useState<AgentSessionDetail | null>(null);
    const [historyIsLoading, setHistoryIsLoading] = useState(false);
    const [historyLoadFailed, setHistoryLoadFailed] = useState(false);
    // Latest list request, so an older one that resolves late cannot overwrite
    // (or, by failing, flag) the answer to a newer one.
    const historyListRequestRef = useRef(0);
    // The team `historySessions` was loaded for. A failed load keeps the rows
    // only for the same team; another team's list is the wrong thing to leave
    // up in this team's shell.
    const historyListTeamRef = useRef<string | null>(null);
    // ----- Session resume (Genos page) -----
    const [resumeIsLoading, setResumeIsLoading] = useState(false);
    const [resumeError, setResumeError] = useState<string | null>(null);

    // User-toggleable gate for the LLM path. `aiAnswers` is checked at
    // the overlay layer (the Ask button is disabled when it's off, and
    // `onAsk` short-circuits as a defense-in-depth guard). Web search is
    // gated server-side from the persisted per-account preference — the
    // client no longer sends a per-request flag.
    const { aiAnswers } = useSpotlightPreferences();

    // Used to abort in-flight searches when the query changes or the
    // overlay closes.
    const abortRef = useRef<AbortController | null>(null);
    // Last query the search effect ran for. Lets the effect tell "the
    // user typed" (debounce) apart from "same query, different filter"
    // (fire immediately — a chip click should feel instant).
    const lastSearchedQueryRef = useRef<string | null>(null);
    // Read latest open state from inside the global keydown listener
    // without re-registering it on every render.
    const isOpenRef = useRef(isOpen);
    useEffect(() => {
        isOpenRef.current = isOpen;
    }, [isOpen]);
    // Same pattern for the page-active flag (read by the Cmd-K branch).
    const isPageActiveRef = useRef(isPageActive);
    useEffect(() => {
        isPageActiveRef.current = isPageActive;
    }, [isPageActive]);
    // Focus function the Genos page registers so Cmd-K can hand focus
    // to the page's input instead of opening the overlay over it.
    const pageInputFocusRef = useRef<(() => void) | null>(null);
    const registerPageInputFocus = useCallback((fn: (() => void) | null) => {
        pageInputFocusRef.current = fn;
    }, []);

    // ---- What happens when a run finishes (`useAgentQA`'s onRunComplete). ----
    //
    // Fires once per turn at a terminal state (clean finish or error) and
    // never for an explicit Cancel or a conversation that was reset, which
    // is exactly when neither a notice nor a demo conversion should happen.
    //
    // 1. Demo funnel: the visitor's first answered ask is the demo's payoff
    //    moment (see `services/demoFunnel`). Only a CLEAN finish counts — a
    //    visitor who saw a failure did not get the answer the demo exists
    //    to show. No-ops entirely outside a demo session.
    // 2. Backgrounded-run notice: closing the overlay deliberately leaves an
    //    in-flight ask streaming, so an answer can land minutes after the
    //    user moved on. Notify unless they are looking at it (overlay open
    //    OR the Genos page showing the conversation full-page, in a tab they
    //    are actually viewing).
    const notificationManagerRef = useRef(notificationManager);
    useEffect(() => {
        notificationManagerRef.current = notificationManager;
    }, [notificationManager]);

    const handleRunComplete = useCallback((run: AgentRunResult) => {
        if (run.error === null) {
            markDemoCompleted({
                origin: askOriginOf(run.meta),
                ...(typeof run.elapsedMs === "number" ? { elapsedMs: run.elapsedMs } : {}),
                sourceCount: run.sourceCount,
            });
        }
        if (isRunBeingWatched(isOpenRef.current || isPageActiveRef.current)) return;
        notifyAgentRunComplete(notificationManagerRef.current, {
            surface: "spotlight",
            askedQuery: run.askedQuery,
            runId: run.runId,
            turnId: run.turnId,
            error: run.error,
            onOpen: () => setIsOpen(true),
        });
    }, []);

    // ---- The conversation: one shared ask/answer state machine. ----
    //
    // Nothing the typing path touches lives in here — `query`, the typeahead
    // and the filters stay in this hook's own state, so a keystroke renders
    // exactly as often as it did when the machine was a private copy.
    //
    // Options: the message for an ask with no team (Spotlight is reachable
    // before a team is picked, so it shows the problem rather than ignoring
    // the click), and `resume` on follow-ups to a transcript the user can
    // see (restored from History or localStorage).
    const qa = useAgentQA({
        accessToken,
        teamId,
        onRunComplete: handleRunComplete,
        noTeamError: t.spotlight.errors.noTeam,
        resumeVisibleSession: true,
    });
    const { ask, turns, sessionId, reset: resetConversation } = qa;

    // ---- Global keyboard shortcut: Cmd-K / Ctrl-K toggles. ----
    // The chord comes from the shortcut registry ("global.spotlight").
    useShortcut("global.spotlight", (e) => {
        // Don't fight system-level Cmd-K behaviors inside text
        // inputs that explicitly handle it (e.g. some editors),
        // but for the app shell this is what we want.
        e.preventDefault();
        // On the Genos page the same surface is already on
        // screen full-page — opening the overlay on top of it
        // would show the conversation twice. Hand focus to the
        // page's input instead. (With the overlay somehow open
        // anyway, fall through so Cmd-K still closes it.)
        if (isPageActiveRef.current && !isOpenRef.current) {
            pageInputFocusRef.current?.();
            return;
        }
        setIsOpen((prev) => !prev);
    });

    // Escape closes the overlay (not a shortcut anyone looks up: every popup does it).
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpenRef.current) {
                // When a Joy Modal is layered on top of Spotlight (e.g.
                // the inline-citation preview), the modal handles Esc
                // itself and should consume the keystroke. Skip closing
                // Spotlight so a single Esc doesn't dismiss BOTH at once.
                // Joy modals render with role="dialog" — query the DOM
                // rather than thread modal state through the hook.
                if (document.querySelector('[role="dialog"]')) return;
                e.preventDefault();
                setIsOpen(false);
            }
        };

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, []);

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
            // `reset` seeds the shared machine's promoted-turn set AND its
            // turn counter from the restored ids, so the first ask after a
            // reload is promoted as the next turn.
            resetConversation({ sessionId: stored.sessionId ?? null, turns: restoredTurns });
        } catch {
            // Ignore corrupt / missing localStorage entries.
        }
    }, [teamId, resetConversation]);

    // ---- "Ask Genos about this task / milestone" (a task menu item). ----
    // The menu is far from here, so it raises `genos:ask-about`. Put the task in
    // the draft as `#PRJ-12 ` and bring the ask up: the overlay, or the page's
    // input when the Genos page is already on screen (the overlay would show the
    // conversation twice, see the Cmd-K handler above). The ref itself waits in
    // `askGenosAbout`'s queue for the input that mounts; the user types the
    // question and presses Ask, nothing is sent here.
    useEffect(
        () =>
            onAskGenosAbout((ref) => {
                setQuery((prev) => withAskGenosToken(prev, askGenosToken(ref)));
                if (isPageActiveRef.current) {
                    pageInputFocusRef.current?.();
                } else {
                    setIsOpen(true);
                }
            }),
        []
    );

    // ---- Overlay close: clear transient results, preserve the draft
    // query, the conversation, AND any in-flight answer. ----
    //
    // Phase 12 behavior change: a close (Escape, click-outside, Cmd-K
    // toggle) preserves `sessionId` and `turns` so the conversation
    // survives an accidental close. Only the explicit
    // "New conversation" button wipes them.
    //
    // The agent can take a while to answer; users want to close the
    // overlay and come back to the result. So an in-flight ASK stream is
    // deliberately NOT aborted on close — the hook lives at the App root,
    // so its stream handlers keep updating `ask` in the background and
    // `onDone` still promotes the finished turn into `turns` (+ persists
    // it). Re-opening shows the streaming answer, or the completed turn
    // if it finished while closed. `isStreaming` is likewise kept true so
    // the spinner (and Cancel button) reflect the still-running request.
    // Only the SEARCH request is aborted here — typeahead results are
    // throwaway once the overlay is dismissed.
    useEffect(() => {
        // Page mode: the Genos page shows the same query/results/filter
        // state full-page, so "overlay closed" must not wipe it while
        // the page is active. This also makes an overlay→page handoff
        // seamless (App closes the overlay when navigating to the page;
        // the state survives because the page is already active).
        // Leaving the page (both false) wipes, matching close semantics.
        if (isOpen || isPageActive) return;
        abortRef.current?.abort();
        abortRef.current = null;
        // `query` is deliberately NOT cleared. A half-composed question
        // is user-authored content, so a stray Escape (or a quick detour
        // to another route) must not discard it — both surfaces seed
        // their input from `query`, so the draft reappears wherever the
        // user comes back. Results / filters / errors ARE dropped:
        // they're derived, and stale rows under a restored draft would
        // misrepresent the index. The next open re-runs the search from
        // the surviving query.
        setResults([]);
        setIsLoading(false);
        setError(null);
        // Filter chips are transient like the query — a fresh open
        // starts unfiltered rather than silently remembering a narrow
        // scope from last time. Same for the project selection: coming
        // back to Cmd-K and silently seeing only one project's content
        // would read as "search is broken".
        setFilterServices([]);
        setFilterProjectIds([]);
    }, [isOpen, isPageActive]);

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
                        sessionId,
                        turns: toStore,
                    })
                );
            } catch {
                // Ignore quota errors silently — conversation still works in-memory.
            }
        }, 500);
        return () => window.clearTimeout(timer);
    }, [turns, sessionId, teamId]);

    // ---- Search by task id (MIP-1040). ----
    // OpenSearch cannot find "MIP-890" (the id is in no chunk), so a query that is
    // NOTHING BUT an id is looked up by number, alongside the ordinary search, and the
    // one task or milestone it finds is pinned at the top. The lookup's client caches
    // hits and remembers misses for 30 s, so typing "MIP-8", "MIP-89", "MIP-890" costs
    // at most one request per id. Kept in its own state so the search pipeline below is
    // untouched; `idHit` remembers which id it answers, so a hit is never shown under
    // a query it does not belong to (the next keystroke hides it at once).
    const [idHit, setIdHit] = useState<{ id: string; result: SpotlightResult } | null>(null);
    const queriedId = isOpen || isPageActive ? displayIdOnlyQuery(query) : null;
    useEffect(() => {
        if (!queriedId || !teamId) return;
        let cancelled = false;
        void lookupTaskByDisplayId({ teamId }, queriedId, accessToken).then((row) => {
            if (cancelled) return;
            setIdHit(row ? { id: queriedId, result: spotlightResultForTask(row) } : null);
        });
        return () => {
            cancelled = true;
        };
    }, [queriedId, teamId, accessToken]);
    const visibleResults = useMemo(() => {
        const hit = idHit && idHit.id === queriedId ? idHit.result : null;
        if (!hit) return results;
        const entityTypes = entityTypesForFilter(
            effectiveFilterServices(filterServices, filterProjectIds)
        );
        const projectIds = projectIdsForFilter(filterProjectIds);
        return idHitPassesFilter(hit, entityTypes, projectIds) ? withIdHit(results, hit) : results;
    }, [idHit, queriedId, results, filterServices, filterProjectIds]);

    // ---- Debounced search on query change while the surface shows
    // (overlay open OR the Genos page active). ----
    useEffect(() => {
        if (!isOpen && !isPageActive) return;
        const trimmed = query.trim();
        if (!trimmed) {
            // Empty query: clear out any previous results immediately.
            abortRef.current?.abort();
            abortRef.current = null;
            lastSearchedQueryRef.current = null;
            setResults([]);
            setIsLoading(false);
            setError(null);
            return;
        }
        if (!teamId) {
            setError(t.spotlight.errors.noTeam);
            return;
        }

        // Debounce only while the query itself is changing (typing).
        // A re-run with the same query — a filter-chip toggle or a
        // project pick — fires immediately so narrowing feels like a
        // click, not a pause.
        const delay = trimmed === lastSearchedQueryRef.current ? 0 : DEBOUNCE_MS;
        lastSearchedQueryRef.current = trimmed;
        // Selected services → entity_types; undefined (spread away)
        // when no chips are active so the request stays byte-identical
        // to the unfiltered wire format.
        //
        // `effectiveFilterServices` drops chips that a live project scope
        // makes impossible (Todos / Genos answers carry no project_id, so
        // scoping them can only return zero). The overlay disables the
        // same chips off the same helper, so the request can never
        // disagree with what the row shows.
        const entityTypes = entityTypesForFilter(
            effectiveFilterServices(filterServices, filterProjectIds)
        );
        // Selected projects → project_ids, same omit-when-empty rule.
        const projectIds = projectIdsForFilter(filterProjectIds);

        // Start a fresh request; supersede any in-flight one.
        abortRef.current?.abort();
        const controller = new AbortController();
        abortRef.current = controller;

        const timer = window.setTimeout(async () => {
            setIsLoading(true);
            setError(null);

            // Progressive render: two passes race on the same signal.
            // The keyword-only pass (use_vector: false) skips the
            // server's query-embedding step entirely — the dominant
            // cost of a hybrid search, and uncacheable for typeahead
            // since every keystroke prefix is new text — so it lands
            // in a few hundred ms and paints first. The full hybrid
            // pass replaces it when ready. `hybridLanded` guards
            // ordering: a slow keyword response must never clobber
            // already-rendered hybrid results.
            let hybridLanded = false;
            let keywordLanded = false;

            void searchSpotlight({
                query: trimmed,
                team_id: teamId,
                limit: RESULT_LIMIT,
                min_score_ratio: RESULT_MIN_SCORE_RATIO,
                min_score: RESULT_MIN_SCORE,
                use_vector: false,
                ...(entityTypes ? { entity_types: entityTypes } : {}),
                // Both lanes carry the scope. If only the hybrid lane
                // did, the fast keyword pass would paint unfiltered
                // rows that then visibly swap out — a flash of results
                // from projects the user just excluded.
                ...(projectIds ? { project_ids: projectIds } : {}),
                accessToken,
                signal: controller.signal,
            })
                .then((data) => {
                    if (controller.signal.aborted || hybridLanded) return;
                    keywordLanded = true;
                    setResults(data.results || []);
                    setIsLoading(false);
                })
                .catch(() => {
                    // Fast lane is best-effort — the hybrid pass below
                    // is authoritative and owns error surfacing.
                });

            try {
                const data = await searchSpotlight({
                    query: trimmed,
                    team_id: teamId,
                    limit: RESULT_LIMIT,
                    min_score_ratio: RESULT_MIN_SCORE_RATIO,
                    min_score: RESULT_MIN_SCORE,
                    use_vector: true,
                    ...(entityTypes ? { entity_types: entityTypes } : {}),
                    ...(projectIds ? { project_ids: projectIds } : {}),
                    accessToken,
                    signal: controller.signal,
                });
                // Drop the response if a newer request has already
                // started (defensive — abort *should* fire first, but
                // the timing window exists).
                if (controller.signal.aborted) return;
                hybridLanded = true;
                setResults(data.results || []);
            } catch (err) {
                if (err instanceof CanceledError) return;
                if (axios.isCancel(err)) return;
                console.error("[Spotlight] search failed", err);
                // Keyword results already on screen beat an error
                // banner — keep them and log; surface the error only
                // when the user would otherwise stare at nothing.
                if (!keywordLanded) setError(t.spotlight.errors.searchFailed);
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        }, delay);

        return () => {
            window.clearTimeout(timer);
            controller.abort();
        };
    }, [query, isOpen, isPageActive, teamId, accessToken, t, filterServices, filterProjectIds]);

    // Chip toggle for the overlay's filter row. Selection order is
    // preserved (pure helper); the search effect above re-fires with
    // zero delay because the query hasn't changed.
    const onToggleFilterService = useCallback((service: SpotlightFilterService) => {
        setFilterServices((prev) => toggleFilterService(prev, service));
    }, []);

    // Project dropdown. The picker is multi-select, so it reports the
    // whole selection rather than one toggled item — no toggle helper
    // needed. Re-fires the search with zero delay like the chips.
    const onChangeFilterProjects = useCallback((projectIds: number[]) => {
        setFilterProjectIds(projectIds);
    }, []);

    const open = useCallback(() => setIsOpen(true), []);
    const close = useCallback(() => setIsOpen(false), []);

    // ---- Enter / Ask button handler: stream the agent's answer. ----
    // `overrideQuery` is supplied by the retry button on past turns and the
    // starter chips so they can bypass the query input state without a
    // render cycle. `mentions` are the structured @/# refs from the
    // overlay's picker; retry re-sends the refs stored on the turn
    // (CompletedTurn.mentions), so a re-ask keeps its references block +
    // search boost.
    //
    // The Spotlight filters — service chips AND the project dropdown — are
    // a SEARCH-ONLY feature: they scope the typeahead, never the agent. An
    // ask is intentionally unscoped so Genos always answers from the full
    // workspace — the user narrowing what they browse must not silently
    // narrow what the assistant can reason over. (Scoping the ask by
    // filter was tried and reverted: fe #177 / api #122.) Nothing derived
    // from `filterServices` / `filterProjectIds` may be added to this call.
    const { onAsk: qaOnAsk } = qa;
    const onAsk = useCallback(
        (
            overrideQuery?: string,
            mentions?: AgentMentionRef[],
            origin: SpotlightAskOrigin = "typed"
        ) => {
            // AI answers disabled in Settings — silently ignore. The UI
            // also disables the Ask button + Enter, so reaching here
            // would only happen via a stale handler or programmatic call.
            // (Spotlight-only: the thread and note asks have no such gate.)
            if (!aiAnswers) return;
            // The draft is this hook's, not the shared machine's, so the
            // text is always passed in explicitly.
            const started = qaOnAsk(
                overrideQuery !== undefined ? overrideQuery : query,
                mentions,
                { origin }
            );
            // Clear the input immediately after submitting. The question is
            // already captured in `ask.askedQuery` and visible in the
            // conversation history, so the input is ready for the next one.
            // An ask that did not start (empty, busy, no team) keeps the draft.
            if (started) setQuery("");
        },
        [aiAnswers, query, qaOnAsk]
    );

    // Approve / reject / cancel / feedback are the shared machine's.
    const { onApprove, onReject, onCancel, submitFeedback, undoStep } = qa;

    // ---- History panel handlers (Phase ~4.6) ----
    //
    // openHistory: switch the panel into list mode and fetch the user's
    // recent sessions. Refetches each time so a session created in
    // another tab shows up without a page reload. It is also the panel's
    // "Retry". A request that FAILS leaves the list as it was (MIP-973):
    // only a successful answer, empty or not, replaces it.
    //
    // viewHistorySession: flip into detail mode and fetch the full Q&A
    // for one session. Optimistically clears the prior detail so the
    // panel doesn't briefly show stale content.
    //
    // backToHistoryList: return from detail to list view without
    // re-fetching the list (still cached from openHistory).
    //
    // closeHistory: drop back to the live conversation (or search if
    // there isn't one). Clears the detail so reopening the panel
    // starts at the list. The session list itself is kept cached so
    // a quick toggle doesn't re-hit the server.
    const openHistory = useCallback(() => {
        setHistoryMode("list");
        setHistoryDetail(null);
        if (!accessToken || !teamId) {
            setHistorySessions([]);
            setHistoryLoadFailed(false);
            historyListTeamRef.current = null;
            return;
        }
        const request = ++historyListRequestRef.current;
        setHistoryIsLoading(true);
        fetchAgentSessions({ accessToken, teamId })
            .then((sessions) => {
                if (request !== historyListRequestRef.current) return;
                if (sessions === null) {
                    setHistoryLoadFailed(true);
                    if (historyListTeamRef.current !== teamId) {
                        setHistorySessions([]);
                        historyListTeamRef.current = null;
                    }
                    return;
                }
                historyListTeamRef.current = teamId;
                setHistoryLoadFailed(false);
                setHistorySessions(sessions);
            })
            .finally(() => {
                if (request === historyListRequestRef.current) setHistoryIsLoading(false);
            });
    }, [accessToken, teamId]);

    const viewHistorySession = useCallback(
        (sessionId: string) => {
            setHistoryMode("detail");
            setHistoryDetail(null);
            if (!accessToken || !teamId) return;
            setHistoryIsLoading(true);
            fetchAgentSessionDetail({ accessToken, teamId, sessionId })
                .then((detail) => setHistoryDetail(detail))
                .finally(() => setHistoryIsLoading(false));
        },
        [accessToken, teamId]
    );

    const backToHistoryList = useCallback(() => {
        setHistoryMode("list");
        setHistoryDetail(null);
    }, []);

    const closeHistory = useCallback(() => {
        setHistoryMode("closed");
        setHistoryDetail(null);
    }, []);

    // ---- New Conversation: clears the session AND prior turns so
    // the next ask starts fresh with no prior-turn context injected. ----
    const onNewConversation = useCallback(() => {
        // Aborts a live stream, drops turns + session, restarts the turn
        // counter and forgets which runs were announced. Not
        // `clearConversation`: that also asks the backend for a brand-new
        // session on the next ask, which Spotlight never did (it just stops
        // sending the session id).
        resetConversation({ sessionId: null, turns: [] });
        // Close any open history view too — otherwise "New conversation"
        // would clear the live session but leave the panel showing a
        // past archive, which is incoherent. A stale resume error is
        // equally moot once the user starts fresh.
        setHistoryMode("closed");
        setHistoryDetail(null);
        setResumeError(null);
        // Wipe persisted state immediately so a reload after "New conversation"
        // opens a blank overlay rather than restoring the cleared history.
        if (teamId) {
            try {
                localStorage.removeItem(STORAGE_KEY(teamId));
            } catch {
                /* ignore */
            }
        }
    }, [teamId, resetConversation]);

    // ---- A conversation was permanently deleted (Settings -> What Genos
    // remembers). ----
    //
    // The delete runs in a panel that cannot reach this hook, so it announces
    // itself (`agentSessionsDeleted`) and every surface that could be showing
    // the conversation reacts. For this hook that means three things:
    //   1. The History list drops the rows, so a deleted conversation cannot
    //      be clicked into a 404.
    //   2. A History detail view of a deleted session closes back to the list.
    //   3. If the LIVE conversation is a deleted one, it is reset exactly the
    //      way "New conversation" resets it. Leaving it up would show a
    //      transcript whose server-side context is gone, and the next
    //      follow-up would silently fork a new session without it.
    // The ids are read through refs: the handler is invoked outside React's
    // render and must see the conversation that is open NOW.
    const liveSessionIdRef = useRef<string | null>(sessionId);
    useEffect(() => {
        liveSessionIdRef.current = sessionId;
    }, [sessionId]);
    const historyDetailSessionIdRef = useRef<string | null>(null);
    useEffect(() => {
        historyDetailSessionIdRef.current = historyDetail?.session_id ?? null;
    }, [historyDetail]);
    useAgentSessionsDeleted((detail) => {
        setHistorySessions((prev) =>
            prev.filter((s) => !deletionCoversSession(detail, s.session_id, teamId))
        );
        if (deletionCoversSession(detail, historyDetailSessionIdRef.current, teamId)) {
            setHistoryDetail(null);
            setHistoryMode((mode) => (mode === "detail" ? "list" : mode));
        }
        if (deletionCoversSession(detail, liveSessionIdRef.current, teamId)) {
            onNewConversation();
        }
    });

    // ---- Resume a past session from the server archive (Genos page). ----
    //
    // Unlike `viewHistorySession` (read-only render), this restores the
    // archived turns into the LIVE conversation: `turns` becomes the
    // transcript, `ask.sessionId` continues the session server-side,
    // and the next `onAsk` sends `resume: true` so an idle-expired
    // session is reused (bounded by history retention) instead of
    // silently forked. No extra LLM call — the visible transcript plus
    // the backend's prior-turn context IS the recap.
    //
    // A sequence counter guards rapid re-clicks: only the latest
    // resume's response applies. On failure the current conversation is
    // left untouched and `resumeError` surfaces the miss.
    const resumeSeqRef = useRef(0);
    const resumeSession = useCallback(
        (sessionId: string) => {
            if (!accessToken || !teamId) return;
            const seq = ++resumeSeqRef.current;
            setResumeIsLoading(true);
            setResumeError(null);
            fetchAgentSessionDetail({ accessToken, teamId, sessionId })
                .then((detail) => {
                    if (seq !== resumeSeqRef.current) return;
                    // fetchAgentSessionDetail resolves null on any
                    // failure (404 outside retention, network) rather
                    // than throwing.
                    if (!detail) {
                        setResumeError(t.spotlight.history.loadFailed);
                        return;
                    }
                    // The restored session replaces whatever was live: `reset`
                    // aborts a stream in flight and clears the notice state.
                    // Slice BEFORE mapping so restored ids stay 1..n and the
                    // next turn id (n+1) can never collide with a seeded
                    // promoted id; the machine seeds its turn counter from
                    // the last restored id. Error turns restore too (they're
                    // part of the transcript), so the transcript matches what
                    // the detail view would have shown.
                    const recent = (detail.turns || []).slice(-MAX_TURNS_IN_HISTORY);
                    resetConversation({
                        sessionId: detail.session_id,
                        turns: recent.map(sessionTurnToCompleted),
                    });
                    setHistoryMode("closed");
                    setHistoryDetail(null);
                    // The localStorage persistence effect snapshots the
                    // restored transcript automatically (same schema).
                })
                .catch(() => {
                    if (seq !== resumeSeqRef.current) return;
                    setResumeError(t.spotlight.history.loadFailed);
                })
                .finally(() => {
                    if (seq === resumeSeqRef.current) setResumeIsLoading(false);
                });
        },
        [accessToken, teamId, t, resetConversation]
    );

    // ---- View a collected past answer (entity_type "spotlight_answer")
    // inline, reusing the live-answer renderer (AgentTurn). No network call —
    // the answer body + its sources already came back on the search result,
    // so we just inject them as a completed (non-streaming) turn. Reset like
    // "New conversation" first so the past answer stands alone rather than
    // appending to an unrelated live conversation. ----
    const { showStaticAnswer } = qa;
    const showStoredAnswer = useCallback(
        (result: SpotlightResult) => {
            showStaticAnswer({
                askedQuery: result.title || "",
                answer: result.answer_text || "",
                answerSources: result.answer_sources || [],
            });
            setHistoryMode("closed");
            setHistoryDetail(null);
        },
        [showStaticAnswer]
    );

    return {
        isOpen,
        open,
        close,
        query,
        setQuery,
        results: visibleResults,
        isLoading,
        error,
        filterServices,
        onToggleFilterService,
        filterProjectIds,
        onChangeFilterProjects,
        onAsk,
        onApprove,
        onReject,
        undoStep,
        onCancel,
        onNewConversation,
        showStoredAnswer,
        ask,
        turns,
        aiAnswersEnabled: aiAnswers,
        historyMode,
        historySessions,
        historyDetail,
        historyIsLoading,
        historyLoadFailed,
        openHistory,
        viewHistorySession,
        backToHistoryList,
        closeHistory,
        submitFeedback,
        resumeSession,
        resumeIsLoading,
        resumeError,
        registerPageInputFocus,
    };
};
