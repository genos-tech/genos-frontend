// Spotlight's shared content region — everything INSIDE the chrome:
// the input row (with @/# mentions and the Ask button), the service /
// project filter chips, the multi-turn conversation panel, and the
// typeahead results list.
//
// Extracted from SpotlightOverlay so two hosts can render the same
// surface:
//   - `SpotlightOverlay` — the Cmd-K modal-style overlay (backdrop +
//     centered Sheet); it renders this inside its Sheet.
//   - The Genos page (`features/genos/GenosHome`) — a full-page
//     ChatGPT-style surface that renders this inside its own layout.
//
// The host owns visibility: this component is only mounted while its
// surface is showing, so the input autofocuses on mount and view-local
// state (result highlight, mention picker) resets naturally when the
// host unmounts it. Conversation state does NOT live here — it belongs
// to `useSpotlight` at the App root, which is what lets a close/reopen
// (or an overlay→page switch) keep the conversation.
//
// The draft text is App-root state for the same reason: `localInput` is
// only a debounce buffer in front of the hook's `query`, seeded back
// from it on mount, so an unsent question survives a close. Picked
// mention refs don't survive, but they don't need to — the inserted
// `@Label` / `#Label` tokens re-resolve against the candidate pool
// (see `useAgentMentionDraft`), so a restored draft asks identically.
//
// Behavioral notes carried over from the overlay:
//   - Typing fires debounced search-only calls; results update live.
//   - Enter / "Ask" invokes `onAsk`, streaming the agent's answer.
//   - Completed turns persist in a scrollable panel; Ask is blocked
//     while a turn is streaming or awaiting write-tool approval.

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Button, Chip, IconButton, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { EmptyState } from "../../components/ui/feedback/EmptyState";
import { ErrorState } from "../../components/ui/feedback/ErrorState";
import { SkeletonLines, SkeletonRows, Spinner } from "../../components/ui/feedback/Skeleton";
import { useBubbleStylePreference } from "../../hooks/common/useBubbleStylePreference";
import { fmt, useTranslation, type Messages } from "../../i18n";
import type {
    AgentSessionDetail,
    AgentSessionSummary,
    AgentSessionTurn,
} from "../../services/agentApi";
import type { MentionGroup } from "../../services/mentionGroupsApi";
import { purplePalette } from "../../theme/purplePalette";
import { g } from "../../theme/tokens";
import type { UserProps } from "../../types/admin";
import type { ProjectProps } from "../../types/tasks";
import {
    agentMarkdownComponents,
    agentQAUrlTransform,
    AgentTurn,
    buildAgentTurnLabels,
    CitationLink,
    FeedbackThumbs,
    markdownAnswerSx,
    MentionHighlightOverlay,
    MentionSuggestionDropdown,
    renderSaveAnswerActions,
    renderSaveAnswerStatus,
    rewriteCitations,
    useAgentMentionDraft,
    useAgentMentionSources,
    type AgentMentionCandidate,
    type AgentMentionRef,
    type AgentTurnLabels,
    type AskState,
    type CompletedTurn,
    type UndoRequest,
} from "../agentQA";
import { takePendingAskRefs } from "./askGenosAbout";
import {
    isServiceDisabledByProjectScope,
    SPOTLIGHT_FILTER_SERVICES,
    type SpotlightFilterService,
} from "./spotlightFilters";
import { SpotlightProjectFilter, SpotlightProjectFilterSummary } from "./SpotlightProjectFilter";
import { SpotlightResultItem } from "./SpotlightResultItem";
import type { SpotlightResult } from "./types";
import type { HistoryMode, SpotlightAskOrigin } from "./useSpotlight";

type SpotlightMessages = Messages["spotlight"];

export interface SpotlightContentProps {
    query: string;
    onQueryChange: (q: string) => void;
    results: SpotlightResult[];
    isLoading: boolean;
    error: string | null;
    // Search-mode service filter chips (under the input box). Hidden in
    // agent mode — once the user asks Genos, the conversation panel owns
    // the surface and results filtering is meaningless.
    filterServices: SpotlightFilterService[];
    onToggleFilterService: (service: SpotlightFilterService) => void;
    // Project scope for search results — a multi-select dropdown next to
    // the service chips (the vocabulary is per-team and can be long, so
    // chips don't scale). Also the source for each result row's
    // project-LABEL chips: the search API returns a bare `project_id`,
    // and labels only exist client-side on `teamProjects`.
    //
    // Threaded as a prop because this overlay mounts OUTSIDE the project
    // provider tree (App renders it above the authed provider stack) —
    // same reason as `mentionMembers` / `mentionGroups`. Optional so
    // callers that don't wire it (tests) keep working: the picker then
    // simply doesn't render.
    projects?: ProjectProps[];
    // Project id → avatar url, resolved by `projectAvatarSrcMap` where
    // the chat list is in scope. Threaded for the same reason as
    // `projects`: a project's avatar lives on its PM chat, which this
    // overlay can't reach. Absent ids fall back to the generic icon.
    projectAvatars?: Map<number, string>;
    // Note id → the sidebar space it lives in, for the personal notes
    // that aren't in My Notes. Threaded for the same reason as
    // `projectAvatars`: the answer lives in note state this surface
    // can't reach, and the search hit doesn't carry it — My, Shared and
    // Team notes are one indexed type. Absent ids are My Notes.
    noteScopes?: ReadonlyMap<number, "shared" | "team">;
    filterProjectIds?: number[];
    onChangeFilterProjects?: (projectIds: number[]) => void;
    // Navigate to the entity's own page, closing Spotlight. Now the
    // ESCAPE HATCH rather than the default: reached by Cmd/Ctrl-clicking
    // a result row (see `handleRowSelect`), and still the fallback
    // `onPreview` uses for kinds with no modal view.
    onSelect: (r: SpotlightResult) => void;
    // Quick-look preview (the existing UrlLinkModal) layered on top of
    // Spotlight rather than navigating away, so the user keeps their
    // place and their conversation. The DEFAULT activation for result
    // rows, inline citations, and answer source chips alike.
    // (`handleSpotlightPreview` falls back to `onSelect` navigation for
    // kinds with no preview modal — project rows, and stored answers,
    // which render inline instead.)
    onPreview: (r: SpotlightResult) => void;
    // `mentions` carries the structured @/# refs the input's picker
    // collected for the live query (absent on retry — see useSpotlight).
    // `origin` is analytics-only; omitted means "typed".
    onAsk: (
        overrideQuery?: string,
        mentions?: AgentMentionRef[],
        origin?: SpotlightAskOrigin
    ) => void;
    onApprove: (editedArgs?: Record<string, unknown>) => void;
    onReject: () => void;
    // Undo one approved write of a turn (`useSpotlight.undoStep`). Required, so a
    // host that renders Spotlight cannot forget it: the overlay and the Genos page
    // both show the same conversation, and each needs the control to work.
    onUndo: (request: UndoRequest) => void;
    onCancel: () => void;
    onNewConversation: () => void;
    // F1 — persist a 👍/👎 rating for a finished turn (keyed by the
    // run_id captured from the `done` stream event). Optional so the
    // overlay renders fine for callers that don't wire feedback.
    onFeedback?: (runId: string, rating: number) => void;
    ask: AskState;
    turns: CompletedTurn[];
    // From Settings → Spotlight → AI answers. When false, the Ask
    // button and Enter shortcut are disabled with an explanatory
    // tooltip and Spotlight stays a pure search overlay.
    aiAnswersEnabled: boolean;
    // The signed-in user is a demo account (server flag). Only the Genos
    // page's starter questions read it (MIP-837); absent means not demo.
    isDemoUser?: boolean;
    // ----- History panel (Phase ~4.6) -----
    // When `historyMode !== "closed"` the conversation panel slot
    // renders a read-only archive instead of the live `turns`/`ask`.
    // The hook owns all loading; the overlay just renders.
    historyMode: HistoryMode;
    historySessions: AgentSessionSummary[];
    historyDetail: AgentSessionDetail | null;
    historyIsLoading: boolean;
    // The list failed to load (not "is empty"): the History list says so and
    // offers a retry, which is `openHistory` again.
    historyLoadFailed: boolean;
    openHistory: () => void;
    viewHistorySession: (sessionId: string) => void;
    backToHistoryList: () => void;
    closeHistory: () => void;
    // Opens the Spotlight-scoped settings modal (LLM model picker + AI
    // answer toggles) from the gear icon on the bar. Owned by the App
    // root so the dialog can layer above this overlay.
    onOpenSettings: () => void;
    // Team roster for the `@` mention menu. Passed as a prop because the
    // overlay mounts OUTSIDE AvatarContext (App.tsx renders it above the
    // authed provider tree); the `#` entities come from
    // HashMentionDataProvider, which App wraps around the overlay.
    mentionMembers?: UserProps[];
    // Mention groups for the `@` picker — same reason as mentionMembers:
    // the overlay mounts outside MentionGroupsProvider.
    mentionGroups?: MentionGroup[];
    // Which host renders this content. "overlay" (default) = the Cmd-K
    // sheet; "page" = the full-page Genos surface. Page mode hides the
    // input row's History icon (the page's session sidebar owns history
    // there — resumable, not read-only) — everything else renders the
    // same.
    variant?: "overlay" | "page";
    // Page mode: lets the host register this content's input-focus
    // function with `useSpotlight.registerPageInputFocus`, so Cmd-K
    // focuses the page input instead of opening the overlay. Called
    // with the focus fn on mount and null on unmount.
    registerInputFocus?: (fn: (() => void) | null) => void;
}

// Distance from the bottom (px) under which we consider the user
// "at the bottom" of the conversation. Streaming auto-scroll only
// fires while at-bottom; if the user has scrolled up to read history,
// we leave them in place.
// Overlay→hook query write debounce (ms). Keystrokes update only the
// overlay-local input; the App-level `query` (and thus the typeahead
// search pipeline) sees the text once the user pauses. 150 keeps the
// worst-case typing→results floor at ~550 ms with the hook's own
// search debounce — an explicit smooth-typing > fast-results tradeoff.
const QUERY_WRITE_DEBOUNCE_MS = 150;

const SCROLL_FOLLOW_THRESHOLD_PX = 50;

// Stable empty defaults for the optional project props. Inline `[]`
// literals would be a fresh identity every render and re-run the
// `projectById` memo (and re-render every memoised result row) on each
// keystroke.
const EMPTY_PROJECTS: ProjectProps[] = [];
const EMPTY_PROJECT_IDS: number[] = [];

// Icons for the search-mode service filter chips. Reuses the same
// icon-per-entity mapping as the agent answer's source chips
// (`_chipIcon` below) so "chat" looks like chat everywhere in the
// overlay.
const FILTER_CHIP_ICON: Record<SpotlightFilterService, React.ReactNode> = {
    chat: <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 14 }} />,
    task: <AssignmentRoundedIcon sx={{ fontSize: 14 }} />,
    note: <StickyNote2RoundedIcon sx={{ fontSize: 14 }} />,
    todo: <TaskAltRoundedIcon sx={{ fontSize: 14 }} />,
    // Sparkle = "AI answer", matching the spotlight_answer result row.
    answer: <AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />,
};

export const SpotlightContent = ({
    query,
    onQueryChange,
    results,
    isLoading,
    error,
    filterServices,
    onToggleFilterService,
    projects,
    projectAvatars,
    noteScopes,
    filterProjectIds,
    onChangeFilterProjects,
    onSelect,
    onPreview,
    onAsk,
    onApprove,
    onReject,
    onUndo,
    onCancel,
    onNewConversation,
    onFeedback,
    ask,
    turns,
    aiAnswersEnabled,
    isDemoUser = false,
    historyMode,
    historySessions,
    historyDetail,
    historyIsLoading,
    historyLoadFailed,
    openHistory,
    viewHistorySession,
    backToHistoryList,
    closeHistory,
    onOpenSettings,
    mentionGroups,
    mentionMembers,
    variant = "overlay",
    registerInputFocus,
}: SpotlightContentProps) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    // What an answer turn says, built once per locale: a new object per render
    // would defeat the memoised turns.
    const turnLabels = useMemo(() => buildAgentTurnLabels(t, "spotlight"), [t]);
    const isDark = mode === "dark";
    // Theme-reactive tokens (CSS variables — repaint with the active
    // color theme). Used by the page variant's card treatments; the
    // overlay keeps its original hard-coded sheet styling.
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    const inputRef = useRef<HTMLTextAreaElement | null>(null);
    // Positioned anchor for the mention dropdown + highlight overlay.
    const inputRowRef = useRef<HTMLDivElement | null>(null);

    // Auto-resize the textarea to fit its contents up to a sensible cap.
    // Below the cap the input expands to show every line the user typed;
    // past the cap it scrolls internally so a runaway paste doesn't push
    // the rest of the overlay off-screen. Re-runs on every keystroke
    // (via `localInput` dep) so wrapped lines are accounted for too.
    useEffect(() => {
        const ta = inputRef.current;
        if (!ta) return;
        ta.style.height = "auto";
        const MAX_HEIGHT = 200;
        ta.style.height = `${Math.min(ta.scrollHeight, MAX_HEIGHT)}px`;
    });

    // Autofocus the input on mount. The host only mounts this content
    // while its surface is showing (overlay open / page active), so
    // mount === "the surface just appeared". Defer to next tick so we
    // don't fight the keydown that triggered an overlay open.
    useEffect(() => {
        const t = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, []);

    // Page mode: hand the host a focus function so Cmd-K can focus this
    // input (see `useSpotlight.registerPageInputFocus`). The ref-based
    // closure stays valid for the component's whole life, so register
    // once on mount.
    useEffect(() => {
        if (!registerInputFocus) return;
        registerInputFocus(() => inputRef.current?.focus());
        return () => registerInputFocus(null);
    }, [registerInputFocus]);

    // Results are rendered in the order the backend returned them —
    // i.e. by relevance score, regardless of entity type. The icon and
    // subtitle on each row make the entity kind obvious, so the
    // user-side cost of mixing chats/tasks/notes is low and the win is
    // getting the most-relevant hit at the top.
    //
    // `resultIndexOf` maps "type:id" → position so each
    // SpotlightResultItem can compute `isHighlighted` without scanning
    // the array on every render.
    const resultIndexOf = useMemo(() => {
        const m = new Map<string, number>();
        results.forEach((r, i) => m.set(`${r.entity_type}:${r.entity_id}`, i));
        return m;
    }, [results]);

    // `project_id` on a result → the project record, so each row can
    // render its project's label chips. Keyed by STRING: project ids are
    // numbers on `ProjectProps` but strings on the wire, and comparing
    // the two directly silently never matches.
    const projectById = useMemo(() => {
        const m = new Map<string, ProjectProps>();
        for (const p of projects ?? EMPTY_PROJECTS) m.set(String(p.projectId), p);
        return m;
    }, [projects]);

    const selectedProjectIds = filterProjectIds ?? EMPTY_PROJECT_IDS;
    // The picker is pointless with nothing to pick from — a caller that
    // doesn't thread projects (or a team with none) gets the old row.
    const showProjectFilter = (projects?.length ?? 0) > 0 && !!onChangeFilterProjects;
    const projectClearLabel = fmt(t.spotlight.filter.projectClear, {
        count: selectedProjectIds.length,
    });

    // Starter questions for the page's empty state (see the render site).
    // Read defensively rather than as `t.spotlight.starters.items`: a
    // non-English catalog is `DeepPartial<Messages>` deep-merged onto
    // English, and `deepMerge` replaces arrays wholesale — so a translator
    // can legitimately ship `items: []`, and a malformed catalog could put
    // a non-array here. Either way the row simply doesn't render.
    const starters = useMemo(() => {
        const items = t.spotlight.starters?.items;
        return Array.isArray(items) ? items.filter((s) => typeof s === "string" && s.trim()) : [];
    }, [t]);

    // ---- Input performance: decouple display from heavy renders. ----
    //
    // `localInput` updates on EVERY keystroke (instant, local). It drives
    // the input's `value`, the mention picker, and the Ask-button check;
    // it never re-enters the hook tree.
    //
    // `onQueryChange` is DEBOUNCED (see `handleInputChange` below) —
    // `query` lives in useSpotlight at the App root, so writing it per
    // keystroke re-renders the whole App. The results list additionally
    // reads a *deferred* copy of `query` so its highlight regex re-runs
    // at low priority when the write does land.
    const [localInput, setLocalInput] = useState(query);

    useEffect(() => {
        setLocalInput(query);
    }, [query]);

    // Trailing debounce for the overlay→hook query write. `query` state
    // lives in useSpotlight at the App ROOT, so an eager per-keystroke
    // setQuery re-renders the whole App — including the keep-alive
    // ChatHome/TaskHome trees — on every character. Typing smoothness
    // beats search latency (product call, 2026-07-11): keystrokes touch
    // only `localInput`; App-level state updates once per pause. Submit
    // never waits on this — both Ask sites pass `localInput` as
    // `overrideQuery`, so the asked text can't go stale.
    const queryWriteTimerRef = useRef<number | null>(null);
    const pendingQueryRef = useRef<string | null>(null);

    const handleInputChange = useCallback(
        (val: string) => {
            setLocalInput(val);
            pendingQueryRef.current = val;
            if (queryWriteTimerRef.current !== null) {
                window.clearTimeout(queryWriteTimerRef.current);
            }
            queryWriteTimerRef.current = window.setTimeout(() => {
                queryWriteTimerRef.current = null;
                if (pendingQueryRef.current !== null) {
                    onQueryChange(pendingQueryRef.current);
                    pendingQueryRef.current = null;
                }
            }, QUERY_WRITE_DEBOUNCE_MS);
        },
        [onQueryChange]
    );

    // External query updates (history restore, post-ask clear, close)
    // supersede anything still pending in the debounce window.
    useEffect(() => {
        if (queryWriteTimerRef.current !== null) {
            window.clearTimeout(queryWriteTimerRef.current);
            queryWriteTimerRef.current = null;
        }
        pendingQueryRef.current = null;
    }, [query]);

    // Unmount = the surface was dismissed (overlay closed / navigated off
    // the Genos page). FLUSH the pending write instead of dropping it: the
    // hook `query` is where the draft survives an unmount, so a user who
    // types and hits Escape inside the debounce window would otherwise
    // lose those last keystrokes. Safe to setState from here — the hook
    // lives at the App root and outlives this component. `submitAsk`
    // nulls the timer, so an ask can't be resurrected as a draft.
    const onQueryChangeRef = useRef(onQueryChange);
    useEffect(() => {
        onQueryChangeRef.current = onQueryChange;
    }, [onQueryChange]);
    useEffect(
        () => () => {
            if (queryWriteTimerRef.current === null) return;
            window.clearTimeout(queryWriteTimerRef.current);
            queryWriteTimerRef.current = null;
            if (pendingQueryRef.current !== null) {
                onQueryChangeRef.current(pendingQueryRef.current);
                pendingQueryRef.current = null;
            }
        },
        []
    );

    // ---- @/# mention picker. ----
    // `@` members and groups come from props (the overlay sits outside
    // AvatarContext and MentionGroupsProvider); `#` entities from
    // HashMentionDataProvider (App wraps the overlay in one). Picking
    // splices a plain-text token into `localInput` via
    // `handleInputChange`, which dual-writes the hook `query` — so
    // `onAsk` still reads the full text.
    // Every project's tasks, like the editors' `#` menu: open-project-only
    // rows made a task elsewhere unmentionable here (MIP-788).
    const mentionSources = useAgentMentionSources({
        membersOverride: mentionMembers,
        groupsOverride: mentionGroups,
        includeTeamTasks: true,
    });
    const mention = useAgentMentionDraft({
        value: localInput,
        onChange: handleInputChange,
        members: mentionSources.members,
        entities: mentionSources.entities,
        lookupTask: mentionSources.lookupTask,
    });
    // "Ask Genos about this task": `useSpotlight` already put `#PRJ-12 ` in the
    // draft; the ref waits in a queue for the input that mounts (the overlay is
    // not mounted while closed). Lock it as a picked mention, put the cursor
    // after the token and focus, so the person types the question and presses
    // Ask. Runs on mount and whenever the draft is written from outside, which
    // is how an already-mounted Genos page hears about it too.
    const { adopt: adoptMentions, setCaret: setMentionCaret } = mention;
    useEffect(() => {
        const refs = takePendingAskRefs();
        if (refs.length === 0) return;
        adoptMentions(refs);
        // The textarea takes the seeded text on the render after this one
        // (`localInput` follows `query`), so place the cursor then.
        const timer = window.setTimeout(() => {
            const ta = inputRef.current;
            if (!ta) return;
            ta.focus();
            const end = ta.value.length;
            ta.setSelectionRange(end, end);
            setMentionCaret(end);
        }, 0);
        return () => window.clearTimeout(timer);
    }, [query, adoptMentions, setMentionCaret]);

    // Submit path: cancel any pending debounced query write (the ask
    // supplies its own text; a post-ask write would just trigger a stray
    // search + App re-render) and hand the CURRENT input to the hook as
    // `overrideQuery` — never the debounced `query`, which may lag the
    // input by up to QUERY_WRITE_DEBOUNCE_MS.
    const { consumeMentions } = mention;
    const submitAsk = useCallback(() => {
        if (queryWriteTimerRef.current !== null) {
            window.clearTimeout(queryWriteTimerRef.current);
            queryWriteTimerRef.current = null;
        }
        pendingQueryRef.current = null;
        onAsk(localInput, consumeMentions(localInput));
    }, [onAsk, localInput, consumeMentions]);

    const syncMentionCaret = useCallback(() => {
        const ta = inputRef.current;
        if (ta) mention.setCaret(ta.selectionStart ?? 0);
    }, [mention]);
    const handleMentionSelect = useCallback(
        (c: AgentMentionCandidate) => {
            const newCaret = mention.selectSuggestion(c);
            // Restore focus + caret once React commits the new value.
            requestAnimationFrame(() => {
                const ta = inputRef.current;
                if (ta) {
                    ta.focus();
                    ta.setSelectionRange(newCaret, newCaret);
                }
            });
        },
        [mention]
    );

    // -1 = nothing highlighted; resets immediately when local input changes
    // (not after the debounce) so the highlight clears as the user types.
    const [selectedIndex, setSelectedIndex] = useState(-1);
    useEffect(() => {
        setSelectedIndex(-1);
    }, [localInput]);

    // Stable activation handler shared by every result row. Without this
    // each row would receive a fresh inline arrow on every keystroke and
    // memoised `SpotlightResultItem` would re-render anyway.
    //
    // A plain click quick-looks the hit in the preview modal, keeping
    // Spotlight (and the conversation behind it) intact — browsing several
    // hits in a row is the common case, and navigating away on the first
    // one threw the search away. Cmd/Ctrl-click is the "actually take me
    // there" escape hatch. Ctrl counts too so the habit transfers off
    // macOS; the rows are <button>s, not links, so neither chord collides
    // with a browser open-in-new-tab.
    const handleRowSelect = useCallback(
        (selected: SpotlightResult, opts?: { viaModifier?: boolean }) => {
            setSelectedIndex(-1);
            if (opts?.viaModifier) {
                onSelect(selected);
                return;
            }
            onPreview(selected);
        },
        [onSelect, onPreview]
    );

    // React schedules updates that depend on `deferredQuery` at low
    // priority. The input value (`localInput`) and Ask-button-enabled
    // gate use the fresh `query`/`localInput`, so typing always feels
    // instant; only the highlight-regex work in each result row catches
    // up afterward. Without this, a long results list could stutter the
    // input on every keystroke even after we dropped the outer debounce.
    const deferredQuery = useDeferredValue(query);

    // Three reasons Ask can be disabled — kept as separate flags so the
    // placeholder/tooltip can explain *why* without re-deriving them.
    const askBusy = ask.isStreaming || ask.pendingApproval !== null;
    const askDisabled = askBusy || !aiAnswersEnabled;
    // Show "Follow up" when there is at least one completed turn or the
    // current session is active — i.e., the user is mid-conversation.
    const hasConversation = turns.length > 0 || Boolean(ask.sessionId);
    // Agent mode: the moment the user presses Enter we flip the layout
    // so the conversation panel becomes the main surface and the input
    // sits at the bottom (chat-style). Using `hasAskContent` rather
    // than `hasConversation` makes the flip happen synchronously on
    // submit — `ask.sessionId` only arrives ~9s later in `onDone`,
    // which would otherwise leave the input awkwardly at the top while
    // the first answer streams in.
    //
    // The history panel also lives in agent mode — opening History
    // from a clean state still flips layout so the archive view gets
    // the full sheet height instead of being squashed under search
    // results that would otherwise be visible.
    const historyOpen = historyMode !== "closed";
    const inAgentMode = hasConversation || hasAskContent(ask) || historyOpen;

    // Use localInput for immediate UI feedback (Ask button state, empty hint).
    // `results` and other hook state still derive from the debounced `query`.
    const trimmedQuery = localInput.trim();
    const hasQuery = trimmedQuery.length > 0;
    const hasResults = results.length > 0;

    // Rendered as a fragment: the host supplies the flex-column
    // container (the overlay's Sheet / the page's main column), so the
    // input row's `order` flip and the panel's `flex: 1` keep working
    // as direct flex items of the host container.
    return (
        <>
            {/* Search-mode resting offset — page only.
                    Sets how far down the input block sits once the user
                    starts typing. `order: -1` puts this above the host's
                    hero greeting (default order 0), and the fixed height
                    means the offset can't vary with the results card's
                    height — the point of the whole arrangement. Roughly
                    half the empty-state centered offset on both phone and
                    desktop columns, so typing lifts the box noticeably
                    without slamming it against the top of the page. */}
            {variant === "page" && !inAgentMode && hasQuery && (
                <Box aria-hidden sx={{ order: -1, flexShrink: 0, height: "18dvh" }} />
            )}

            {/* Input row + Ask button.
                    In agent mode the input moves to the bottom of the
                    sheet (chat-style) via `order: 2`; the border flips
                    from below (search-mode separator above results) to
                    above (separator below the conversation panel).
                    Hidden entirely while browsing history — the user
                    opened the history view to read past sessions, not
                    to start a new ask. They close history (the "Back
                    to search" button on the panel) to bring the input
                    back. */}
            {!historyOpen && (
                <Box
                    ref={inputRowRef}
                    sx={{
                        display: "flex",
                        // Anchor for the @/# mention dropdown.
                        position: "relative",
                        // Overlay: top-align so the SearchIcon / Ask button
                        // stay anchored to the first line as the textarea
                        // grows downward. Page: the hero pill is taller, so
                        // top-aligning left the single-line placeholder
                        // visibly above center — center instead (the
                        // textarea still grows; icons ride its middle).
                        alignItems: variant === "page" ? "center" : "flex-start",
                        // Tighter on mobile so SearchIcon + input + Ask
                        // all fit on a 390px-wide viewport.
                        gap: { xs: 0.5, sm: 1 },
                        px: { xs: 1, sm: 2 },
                        py: { xs: 1, sm: 1.5 },
                        order: inAgentMode ? 2 : 0,
                        ...(inAgentMode
                            ? {
                                  borderTop: "1px solid",
                                  borderColor: isDark
                                      ? "rgba(255,255,255,0.06)"
                                      : "rgba(0,0,0,0.06)",
                              }
                            : variant === "page"
                              ? {
                                    // Page hero: a free-standing rounded
                                    // input (ChatGPT-style) rather than the
                                    // overlay's row-with-separator — the
                                    // sheet chrome that made a bare border
                                    // read as "one row of a panel" isn't
                                    // there on the page. Accent-tinted
                                    // border + focus ring follow the active
                                    // color theme (purplePalette CSS vars).
                                    border: "1px solid",
                                    borderColor: `rgba(${palette.accentRgb}, ${isDark ? 0.28 : 0.22})`,
                                    borderRadius: "16px",
                                    background: palette.surfaceSolid,
                                    boxShadow: isDark
                                        ? `0 4px 24px rgba(0,0,0,0.25), 0 0 0 1px rgba(${palette.accentRgb}, 0.06)`
                                        : `0 4px 24px rgba(${palette.accentRgb}, 0.10)`,
                                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                                    "&:focus-within": {
                                        borderColor: `rgba(${palette.accentRgb}, ${isDark ? 0.55 : 0.45})`,
                                        boxShadow: isDark
                                            ? `0 4px 28px rgba(0,0,0,0.3), 0 0 0 3px rgba(${palette.accentRgb}, 0.18)`
                                            : `0 4px 28px rgba(${palette.accentRgb}, 0.14), 0 0 0 3px rgba(${palette.accentRgb}, 0.12)`,
                                    },
                                }
                              : {
                                    borderBottom: "1px solid",
                                    borderColor: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.06)",
                                }),
                    }}
                >
                    <SearchRoundedIcon
                        sx={{
                            opacity: 0.7,
                            fontSize: { xs: 18, sm: 24 },
                            flexShrink: 0,
                            // Overlay (top-aligned row): nudge down so the
                            // icon sits on the first line's baseline instead
                            // of the textarea's top edge. Page rows are
                            // center-aligned — no nudge needed.
                            mt: variant === "page" ? 0 : { xs: "2px", sm: "3px" },
                        }}
                    />
                    {/* In agent mode the input row sits at the bottom
                            of the sheet (order: 2), so the dropdown opens
                            upward; in search mode it opens downward over
                            the results list. */}
                    {mention.pickerOpen && (
                        <MentionSuggestionDropdown
                            anchorRef={inputRowRef}
                            ariaLabel={t.spotlight.mentions.ariaLabel}
                            highlightIndex={mention.highlightIndex}
                            isDark={isDark}
                            placement={inAgentMode ? "above" : "below"}
                            suggestions={mention.suggestions}
                            onSelect={handleMentionSelect}
                        />
                    )}
                    {/* Marker highlight over live mention tokens, so a
                            picked mention is visibly different from the
                            same words merely typed. */}
                    <MentionHighlightOverlay
                        containerRef={inputRowRef}
                        isDark={isDark}
                        ranges={mention.highlightRanges}
                        elementRef={inputRef}
                        value={localInput}
                    />
                    <Box
                        ref={inputRef}
                        component="textarea"
                        rows={1}
                        value={localInput}
                        placeholder={
                            askBusy
                                ? t.spotlight.placeholder.askBusy
                                : !aiAnswersEnabled
                                  ? t.spotlight.placeholder.aiOff
                                  : hasConversation
                                    ? t.spotlight.placeholder.followUp
                                    : t.spotlight.placeholder.default
                        }
                        sx={{
                            flex: 1,
                            minWidth: 0,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            color: g.text.primary,
                            fontSize: { xs: "0.9375rem", sm: "1.0625rem" },
                            fontFamily: "inherit",
                            // Native browsers add ~5px padding around
                            // textareas; strip it so the layout matches
                            // the previous <input> baseline exactly.
                            p: 0,
                            // User can't manual-drag the corner — the
                            // height is auto-fit via the effect above.
                            resize: "none",
                            // Below the cap the effect grows the height
                            // to fit content; past the cap (200px) the
                            // textarea scrolls internally instead of
                            // pushing the rest of the overlay off-screen.
                            overflowY: "auto",
                            lineHeight: 1.4,
                            "::placeholder": { color: g.text.tertiary, opacity: 1 },
                        }}
                        onClick={syncMentionCaret}
                        onKeyUp={syncMentionCaret}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                            handleInputChange(e.target.value);
                            mention.setCaret(e.target.selectionStart ?? e.target.value.length);
                        }}
                        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                            // IME guard: while an input-method composition
                            // is active (Japanese / Chinese / Korean, or
                            // accented input), Enter CONFIRMS the composition
                            // rather than submitting, and Arrow keys drive
                            // the candidate window. Bail so the IME owns the
                            // key. Without this, the confirming Enter both
                            // fires the ask AND leaves the committed text
                            // behind: its trailing onChange repopulates the
                            // input after submitAsk cleared `query`.
                            // `isComposing` is the modern signal; keyCode 229
                            // is the legacy sentinel for engines missing it.
                            if (e.nativeEvent.isComposing || e.keyCode === 229) return;
                            // Mention-picker precedence: while the @/#
                            // dropdown is open it owns Arrow / Enter /
                            // Escape, beating result-row navigation and
                            // ask-submit below. Escape additionally
                            // stops propagation so the document-level
                            // listener in useSpotlight doesn't close
                            // the whole overlay on the same keystroke.
                            if (mention.pickerOpen) {
                                if (e.key === "ArrowDown") {
                                    e.preventDefault();
                                    mention.moveHighlight(1);
                                    return;
                                }
                                if (e.key === "ArrowUp") {
                                    e.preventDefault();
                                    mention.moveHighlight(-1);
                                    return;
                                }
                                if (
                                    e.key === "Enter" &&
                                    !e.shiftKey &&
                                    !e.metaKey &&
                                    !e.ctrlKey &&
                                    !e.altKey
                                ) {
                                    e.preventDefault();
                                    const c = mention.suggestions[mention.highlightIndex];
                                    if (c) handleMentionSelect(c);
                                    return;
                                }
                                if (e.key === "Escape") {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    mention.closePicker();
                                    return;
                                }
                            }
                            // Once the query spans multiple lines, the
                            // user almost certainly wants Up/Down to
                            // move the caret between lines rather than
                            // hijack focus into the result list. Fall
                            // through to the textarea's default for
                            // multi-line content; keep result-row
                            // navigation for the single-line common case.
                            //
                            // "Multi-line" must count SOFT-wrapped text
                            // too: a long query with no explicit "\n"
                            // still renders on >1 visual row, and the
                            // user expects Up/Down to walk those rows.
                            // `includes("\n")` alone missed that case, so
                            // arrows kept jumping to the results. Measure
                            // the textarea's rendered rows (scrollHeight /
                            // line-height) to cover both.
                            const ta = inputRef.current;
                            const lineHeightPx = ta
                                ? parseFloat(getComputedStyle(ta).lineHeight)
                                : 0;
                            const visualRows =
                                ta && lineHeightPx > 0
                                    ? Math.round(ta.scrollHeight / lineHeightPx)
                                    : 1;
                            const isMultiline = localInput.includes("\n") || visualRows > 1;
                            if (e.key === "ArrowDown" && !isMultiline) {
                                if (results.length === 0) return;
                                e.preventDefault();
                                setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
                                return;
                            }
                            if (e.key === "ArrowUp" && !isMultiline) {
                                e.preventDefault();
                                setSelectedIndex((prev) => Math.max(prev - 1, -1));
                                return;
                            }
                            if (e.key === "Enter") {
                                // Shift+Enter inserts a newline (the
                                // textarea handles it natively); any
                                // other modifier (Cmd/Ctrl/Alt) is
                                // treated the same so users with
                                // varying habits aren't surprised by
                                // an accidental submit.
                                if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) {
                                    return;
                                }
                                e.preventDefault();
                                // If a result row is highlighted, open it
                                // rather than firing the AI ask. Routed
                                // through `handleRowSelect` so the keyboard
                                // lands on the same preview modal a click
                                // does. (No Cmd-Enter navigate variant: the
                                // modifier guard above deliberately makes
                                // any modified Enter a no-op.)
                                if (selectedIndex >= 0 && results[selectedIndex]) {
                                    handleRowSelect(results[selectedIndex]);
                                    return;
                                }
                                // Block Enter from firing a new ask while the
                                // previous turn is still streaming or awaiting
                                // user approval. The input itself stays
                                // editable so the search typeahead keeps
                                // working in the results section below.
                                if (askDisabled) return;
                                submitAsk();
                            }
                        }}
                    />
                    {ask.isStreaming && (
                        <Button
                            color="danger"
                            size="sm"
                            sx={{ fontSize: "0.875rem", whiteSpace: "nowrap" }}
                            variant="plain"
                            onClick={onCancel}
                        >
                            {t.spotlight.actions.cancel}
                        </Button>
                    )}
                    <AppTooltip
                        size="sm"
                        title={!aiAnswersEnabled ? t.spotlight.errors.enableAiHint : ""}
                        // Empty title disables the tooltip in MUI Joy.
                        placement="bottom"
                    >
                        {/* Span wrapper lets the tooltip fire over a
                            disabled button (pointer events on a disabled
                            <button> are suppressed in Chromium). */}
                        <Box component="span" sx={{ display: "inline-flex", flexShrink: 0 }}>
                            <Button
                                color="primary"
                                disabled={!hasQuery || askDisabled}
                                size="sm"
                                variant="solid"
                                startDecorator={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
                                sx={{
                                    // Mobile: collapse to an icon-only
                                    // square so the row stays single-line
                                    // at 390px. The startDecorator icon is
                                    // visually clear ("Ask AI") on its own.
                                    px: { xs: 1, sm: 1.5 },
                                    minWidth: 0,
                                    "& .MuiButton-startDecorator": {
                                        m: { xs: 0, sm: undefined },
                                    },
                                }}
                                onClick={submitAsk}
                            >
                                <Box
                                    component="span"
                                    sx={{ display: { xs: "none", sm: "inline" } }}
                                >
                                    {t.spotlight.actions.ask}
                                </Box>
                            </Button>
                        </Box>
                    </AppTooltip>
                    {/* History entry point — persistent across search
                        and agent modes (sits right of Ask so a returning
                        user with no live conversation in localStorage
                        can still reach their past sessions). Clicking
                        switches the panel into the History list view
                        (re-fetches once per click; bounded ≤20 rows).
                        Hidden on the Genos page — its session sidebar is
                        the history surface there, and clicking a session
                        RESUMES it rather than opening this read-only
                        archive. */}
                    {variant !== "page" && (
                        <AppTooltip
                            placement="bottom"
                            size="sm"
                            title={t.spotlight.history.openTooltip}
                        >
                            <IconButton
                                color="neutral"
                                size="sm"
                                sx={{ minWidth: 0, p: "3px", flexShrink: 0 }}
                                variant="plain"
                                onClick={openHistory}
                            >
                                <HistoryRoundedIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
                            </IconButton>
                        </AppTooltip>
                    )}
                    {/* Spotlight settings — switch LLM model (Gemini /
                        Claude) + toggle AI answers / web search without
                        leaving the overlay. Sits right of History; opens a
                        dedicated modal layered above this overlay. */}
                    <AppTooltip
                        placement="bottom"
                        size="sm"
                        title={t.spotlight.settings.openTooltip}
                    >
                        <IconButton
                            color="neutral"
                            size="sm"
                            sx={{ minWidth: 0, p: "3px", flexShrink: 0 }}
                            variant="plain"
                            onClick={onOpenSettings}
                        >
                            <SettingsRoundedIcon sx={{ fontSize: { xs: 18, sm: 20 } }} />
                        </IconButton>
                    </AppTooltip>
                </Box>
            )}

            {/* Starter questions — the page's empty state ONLY.
                    The placeholder says "press Enter to ask Genos", but a
                    first-time visitor on a centered empty box has no idea
                    what's worth asking, and an unasked question is the one
                    failure mode no amount of answer quality fixes. These
                    give three one-click asks.

                    Every clause of the gate is load-bearing:
                      - `variant === "page"`: the overlay is opened by ⌘K,
                        i.e. deliberately, by someone who already knows what
                        Spotlight is — and its sheet has no room to spare.
                      - `!inAgentMode`: past the first ask the conversation
                        panel owns the surface, and "Ask a follow-up" is the
                        affordance there.
                      - `!hasQuery`: the moment anything is typed the
                        visitor has their own question; replacing it with a
                        starter would throw their text away.
                      - `aiAnswersEnabled`: HIDDEN, not disabled. `onAsk`
                        silently returns when AI answers are off, so a
                        visible chip would do nothing at all on click —
                        worse than absent. (Contrast the service chips
                        below, which stay visible-but-disabled: those
                        describe a *selection* that still exists.)
                      - `isDemoUser`: the starters are for demo visitors,
                        who land in a sandbox with no idea what to ask. A
                        real user has their own work to ask about. It is
                        the server's `is_demo` flag, false until the profile
                        loads, so a real user never sees the row flash in.

                    `onAsk(item)` and not `setQuery` + submit: `overrideQuery`
                    is exactly the "ask this, never mind the input" path the
                    retry button already uses, so no debounce or render cycle
                    sits between the click and the ask. No mentions are
                    passed — these name no entity, by design. */}
            {variant === "page" &&
                !inAgentMode &&
                !hasQuery &&
                aiAnswersEnabled &&
                isDemoUser &&
                starters.length > 0 && (
                    <Box
                        aria-label={t.spotlight.starters.label}
                        role="group"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexWrap: "wrap",
                            gap: 0.75,
                            px: { xs: 1, sm: 2 },
                            pt: 1.5,
                        }}
                    >
                        <Typography
                            level="body-xs"
                            sx={{
                                fontWeight: 700,
                                mr: 0.25,
                                whiteSpace: "nowrap",
                                color: g.text.tertiary,
                            }}
                        >
                            {t.spotlight.starters.label}
                        </Typography>
                        {starters.map((item) => (
                            <Chip
                                key={item}
                                color="neutral"
                                size="sm"
                                startDecorator={<AutoAwesomeRoundedIcon sx={{ fontSize: 14 }} />}
                                variant="soft"
                                sx={{
                                    "--Chip-minHeight": "28px",
                                    fontWeight: 500,
                                    // Joy's Chip label is `nowrap` + ellipsis and
                                    // the root is `max-content`, so a full
                                    // sentence would run off a phone screen.
                                    // Cap the width and let it truncate — the
                                    // click still asks the whole question, and
                                    // the title attribute shows it in full.
                                    maxWidth: { xs: "100%", sm: 340 },
                                    ...(isDark
                                        ? {
                                              color: g.text.secondary,
                                              backgroundColor: g.hover,
                                          }
                                        : {}),
                                }}
                                title={item}
                                onClick={() => onAsk(item, undefined, "starter")}
                            >
                                {item}
                            </Chip>
                        ))}
                    </Box>
                )}

            {/* Service filter chips — search mode ONLY. The moment an
                    ask starts (inAgentMode), the conversation panel owns
                    the surface and the chips disappear; "New conversation"
                    brings them back with the search view. An empty
                    selection means "everything" (backend default); active
                    chips narrow the search to those services and re-fire
                    it immediately. */}
            {!inAgentMode && (
                <Box
                    aria-label={t.spotlight.filter.ariaLabel}
                    role="group"
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: 0.75,
                        px: { xs: 1, sm: 2 },
                        py: 0.75,
                        // The separator belongs to the overlay's stacked
                        // sheet; on the page the chips float free under
                        // the hero input.
                        ...(variant === "page"
                            ? { pt: 1.25 }
                            : {
                                  borderBottom: "1px solid",
                                  borderColor: isDark
                                      ? "rgba(255,255,255,0.06)"
                                      : "rgba(0,0,0,0.06)",
                              }),
                    }}
                >
                    <Typography
                        level="body-xs"
                        sx={{
                            fontWeight: 700,
                            mr: 0.25,
                            whiteSpace: "nowrap",
                            color: g.text.tertiary,
                        }}
                    >
                        {t.spotlight.filter.label}
                    </Typography>
                    {SPOTLIGHT_FILTER_SERVICES.map((service) => {
                        // Todos and Genos answers carry no project_id,
                        // so a live project scope makes them a
                        // guaranteed-empty search. Disable rather than
                        // hide (hiding would look like the chip row
                        // lost items), and show unpressed — the search
                        // drops them via `effectiveFilterServices`, so
                        // this is what's actually being applied. The
                        // user's underlying selection is untouched and
                        // comes back when the scope is cleared.
                        const scopeDisabled = isServiceDisabledByProjectScope(
                            service,
                            selectedProjectIds
                        );
                        const active = filterServices.includes(service) && !scopeDisabled;
                        return (
                            <AppTooltip
                                key={service}
                                placement="bottom"
                                size="sm"
                                title={
                                    scopeDisabled
                                        ? t.spotlight.filter.projectScopeIncompatible
                                        : ""
                                }
                            >
                                <Chip
                                    color={active ? "primary" : "neutral"}
                                    disabled={scopeDisabled}
                                    size="sm"
                                    startDecorator={FILTER_CHIP_ICON[service]}
                                    variant={active ? "solid" : "soft"}
                                    slotProps={{
                                        action: {
                                            "aria-pressed": active,
                                            "aria-disabled": scopeDisabled,
                                        },
                                    }}
                                    sx={{
                                        "--Chip-minHeight": "26px",
                                        fontWeight: 600,
                                        // Soft neutral chips vanish against the
                                        // translucent dark sheet — give inactive
                                        // ones an explicit bg + readable text.
                                        ...(isDark && !active
                                            ? {
                                                  color: g.text.secondary,
                                                  backgroundColor: g.hover,
                                              }
                                            : {}),
                                        ...(scopeDisabled ? { opacity: 0.45 } : {}),
                                    }}
                                    onClick={() => {
                                        if (scopeDisabled) return;
                                        onToggleFilterService(service);
                                    }}
                                >
                                    {t.spotlight.filter[service]}
                                </Chip>
                            </AppTooltip>
                        );
                    })}
                    {/* Project scope, immediately after the service
                            chips (i.e. right of "Genos answers"). A
                            dropdown, not a chip: the options are the
                            team's project list, which can run long, and
                            the user picks from it rather than toggling a
                            fixed vocabulary. Same selection semantics as
                            the chips though — empty means "everything",
                            picking re-fires the search instantly, and it
                            resets when the overlay closes. */}
                    {showProjectFilter && (
                        <>
                            <SpotlightProjectFilter
                                ariaLabel={t.spotlight.filter.projectAriaLabel}
                                isDark={isDark}
                                placeholder={t.spotlight.filter.projectPlaceholder}
                                projectAvatars={projectAvatars}
                                projects={projects ?? EMPTY_PROJECTS}
                                selectedIds={selectedProjectIds}
                                onChange={onChangeFilterProjects}
                            />
                            <SpotlightProjectFilterSummary
                                clearLabel={projectClearLabel}
                                count={selectedProjectIds.length}
                                isDark={isDark}
                                label={t.spotlight.filter.projectScopeLabel}
                                onClear={() => onChangeFilterProjects([])}
                            />
                        </>
                    )}
                </Box>
            )}

            {/* Conversation history + current in-flight turn.
                    Rendered as a single scrollable region so past turns
                    stay readable while a new one streams in below them.
                    When the user opens History from the header, this
                    same slot renders a read-only archive instead. */}
            <ConversationPanel
                ask={ask}
                askDisabled={askDisabled}
                historyDetail={historyDetail}
                historyIsLoading={historyIsLoading}
                historyLoadFailed={historyLoadFailed}
                historyMode={historyMode}
                historySessions={historySessions}
                isDark={isDark}
                noteScopes={noteScopes}
                ts={t.spotlight}
                turnLabels={turnLabels}
                turns={turns}
                variant={variant}
                onApprove={onApprove}
                onAsk={onAsk}
                onBackToHistoryList={backToHistoryList}
                onCloseHistory={closeHistory}
                onFeedback={onFeedback}
                onNewConversation={onNewConversation}
                onPreview={onPreview}
                onReject={onReject}
                onRetryHistory={openHistory}
                onUndo={onUndo}
                onViewHistorySession={viewHistorySession}
            />

            {/* Results / states — hidden the moment an ask is in
                    flight (not waiting for `hasConversation` which only
                    flips on sessionId). In Q&A mode the user is talking
                    to the agent, not browsing search results. "New
                    conversation" in the conversation header returns
                    them to search. */}
            <Box
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    // Overlay: the results region greedily fills the
                    // sheet. Page: it sizes to content (bounded) — a
                    // flex:1 card would stretch to the viewport bottom
                    // and read as a mostly-empty box behind two rows.
                    // On the page it's also its own bordered card:
                    // free-floating rows with no container read as
                    // unfinished there (the overlay's sheet chrome
                    // provides the frame).
                    flex: variant === "page" ? "0 1 auto" : 1,
                    ...(variant === "page"
                        ? {
                              maxHeight: "48vh",
                              mt: 0.5,
                              // Soak up the column's leftover height
                              // BELOW the card. An auto margin consumes
                              // free space before `justify-content` gets
                              // any, so the host's hero centering is
                              // bypassed while this card is in the flex
                              // flow: what's above the input is then only
                              // the fixed spacer at the top of this
                              // fragment, so the input holds still no
                              // matter how the card's own height changes.
                              // That's what stops it drifting up and down
                              // as the result count shifts mid-typing.
                              // With an empty query the card is
                              // `display: none` (below) and leaves the
                              // flex flow, so the host re-centers the
                              // hero. Net effect: the input has exactly
                              // TWO positions — centered when empty, and
                              // the spacer's offset once anything is typed
                              // (including a query that finds nothing).
                              mb: "auto",
                              border: "1px solid",
                              borderColor: palette.divider,
                              borderRadius: "16px",
                              background: palette.surfaceElevated,
                              boxShadow: isDark
                                  ? "0 12px 32px rgba(0,0,0,0.35)"
                                  : "0 12px 32px rgba(15,15,30,0.08)",
                          }
                        : {}),
                    overflowY: "auto",
                    px: 1,
                    py: 1,
                    // Nothing renders here with an empty query (the
                    // "start typing" hint was removed), so collapse the
                    // box instead of leaving stray padding.
                    display: inAgentMode || !hasQuery ? "none" : undefined,
                }}
            >
                {hasQuery && isLoading && !hasResults && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 1.5,
                            py: 1,
                        }}
                    >
                        <Spinner />
                        <Typography
                            level="body-md"
                            sx={{
                                color: g.text.secondary,
                            }}
                        >
                            {t.spotlight.states.searching}
                        </Typography>
                    </Box>
                )}

                {hasQuery && error && <EmptyHint text={error} tone="error" />}

                {hasQuery && !isLoading && !error && !hasResults && (
                    <EmptyHint text={t.spotlight.empty.noMatches} />
                )}

                {hasResults && (
                    <Box
                        sx={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 0.25,
                        }}
                    >
                        {results.map((r) => {
                            // Resolved here rather than inside the
                            // row so the lookup map is built once per
                            // results change instead of per row — and
                            // so a row with no project, or one the
                            // viewer's `teamProjects` hasn't loaded,
                            // simply gets undefined and renders no
                            // label chips.
                            const rowProject = r.project_id
                                ? projectById.get(r.project_id)
                                : undefined;
                            return (
                                <SpotlightResultItem
                                    key={`${r.entity_type}:${r.entity_id}`}
                                    noteScopes={noteScopes}
                                    project={rowProject}
                                    query={deferredQuery}
                                    result={r}
                                    isHighlighted={
                                        resultIndexOf.get(`${r.entity_type}:${r.entity_id}`) ===
                                        selectedIndex
                                    }
                                    onSelect={handleRowSelect}
                                />
                            );
                        })}
                    </Box>
                )}
            </Box>
        </>
    );
};

const EmptyHint = ({ text, tone }: { text: string; tone?: "error" }) => (
    <Box sx={{ px: 1.5, py: 1.25 }}>
        <Typography
            level="body-md"
            sx={{
                color: tone === "error" ? g.danger.text : g.text.secondary,
            }}
        >
            {text}
        </Typography>
    </Box>
);

// ──────────────────────────────────────────────────────────────────
// ConversationPanel — Phase 12 multi-turn history container
//
// Renders, in document order:
//   1. A conversation header with the "New conversation" button
//      (visible when there's any prior turn or an active sessionId).
//   2. Every completed turn from `turns` as an immutable <AgentTurn>.
//   3. The in-flight `ask` as a current-flagged <AgentTurn>, if it
//      has anything to show.
//
// Auto-scroll: when the user is at (or near) the bottom of the
// container, new content scrolls into view via requestAnimationFrame
// (coalesces high-frequency answer_delta updates). When the user
// scrolls up to read history, follow mode is disabled until they
// manually scroll back to the bottom OR a new turn starts.
// ──────────────────────────────────────────────────────────────────

interface ConversationPanelProps {
    ask: AskState;
    turns: CompletedTurn[];
    isDark: boolean;
    onPreview: (r: SpotlightResult) => void;
    onApprove: (editedArgs?: Record<string, unknown>) => void;
    onReject: () => void;
    // Required: see `SpotlightContentProps.onUndo`.
    onUndo: (request: UndoRequest) => void;
    onNewConversation: () => void;
    onAsk: (
        overrideQuery?: string,
        mentions?: AgentMentionRef[],
        origin?: SpotlightAskOrigin
    ) => void;
    onFeedback?: (runId: string, rating: number) => void;
    askDisabled: boolean;
    ts: SpotlightMessages;
    // What a turn says (see `buildAgentTurnLabels`); memoised on `t` by the
    // caller so the turns' memo holds.
    turnLabels: AgentTurnLabels;
    // Passed down for the source chips, which name each cited entity with
    // the same vocabulary as the result rows.
    noteScopes?: ReadonlyMap<number, "shared" | "team">;
    // History panel — when historyMode !== "closed" the panel renders
    // a read-only archive in place of turns/ask. The "open history"
    // entry point lives in the input row (always visible across modes),
    // so ConversationPanel only needs the close + back-to-list +
    // view-session callbacks here.
    historyMode: HistoryMode;
    historySessions: AgentSessionSummary[];
    historyDetail: AgentSessionDetail | null;
    historyIsLoading: boolean;
    historyLoadFailed: boolean;
    onRetryHistory: () => void;
    onViewHistorySession: (sessionId: string) => void;
    onBackToHistoryList: () => void;
    onCloseHistory: () => void;
    // Page renders the panel as its own bordered card (the overlay's
    // sheet already frames it).
    variant?: "overlay" | "page";
}

// Exported for the Genos page (GenosHome), which needs the same
// "is the conversation surface active?" derivation to decide between
// the centered-hero empty state and the chat-style filled state.
// eslint-disable-next-line react-refresh/only-export-components
export const hasAskContent = (ask: AskState): boolean =>
    ask.isStreaming ||
    Boolean(ask.answer) ||
    Boolean(ask.askError) ||
    ask.answerSources.length > 0 ||
    ask.toolEvents.length > 0 ||
    ask.pendingApproval !== null;

// memo: prevents re-renders when only localInput (the typing state) changes.
// ConversationPanel has no dependency on the query — it only re-renders when
// ask/turns/isDark/callbacks change, which happens on streaming events,
// not on every keystroke.
const ConversationPanel = memo(
    ({
        ask,
        turns,
        isDark,
        onPreview,
        onApprove,
        onReject,
        onUndo,
        onNewConversation,
        onAsk,
        onFeedback,
        askDisabled,
        ts,
        turnLabels,
        noteScopes,
        historyMode,
        historySessions,
        historyDetail,
        historyIsLoading,
        historyLoadFailed,
        onRetryHistory,
        onViewHistorySession,
        onBackToHistoryList,
        onCloseHistory,
        variant = "overlay",
    }: ConversationPanelProps) => {
        const scrollRef = useRef<HTMLDivElement | null>(null);
        // The answer turns take the same look as every message and comment.
        const { style: turnLayout } = useBubbleStylePreference();
        // Retry composed from a ref to `onAsk`, so the finished turns see ONE
        // identity for it. The hook's `onAsk` is re-minted whenever the draft
        // query is written (it reads the draft), and handing that straight to
        // the memoised turns re-rendered every one of them on each write.
        const onAskRef = useRef(onAsk);
        onAskRef.current = onAsk;
        const onRetry = useCallback(
            (askedQuery: string, mentions?: AgentMentionRef[]) =>
                onAskRef.current(askedQuery, mentions, "retry"),
            []
        );
        // True when the user has scrolled away from the bottom. We pause
        // auto-follow until they return to the bottom themselves OR a new
        // turn starts (whichever happens first).
        const userScrolledUpRef = useRef(false);
        const rafIdRef = useRef<number | null>(null);

        const historyOpen = historyMode !== "closed";
        // The panel renders when there's any conversation activity OR
        // when the user has explicitly opened History (which can happen
        // from a clean state too).
        const showHeader =
            turns.length > 0 || Boolean(ask.sessionId) || hasAskContent(ask) || historyOpen;
        const showAsk = hasAskContent(ask);

        // Auto-scroll on relevant updates. requestAnimationFrame coalesces
        // bursts of answer_delta events so we scroll at most once per frame.
        useEffect(() => {
            const el = scrollRef.current;
            if (!el) return;
            if (userScrolledUpRef.current) return;
            if (rafIdRef.current !== null) {
                cancelAnimationFrame(rafIdRef.current);
            }
            rafIdRef.current = requestAnimationFrame(() => {
                rafIdRef.current = null;
                el.scrollTo({ top: el.scrollHeight });
            });
            return () => {
                if (rafIdRef.current !== null) {
                    cancelAnimationFrame(rafIdRef.current);
                    rafIdRef.current = null;
                }
            };
        }, [
            ask.answer,
            ask.isStreaming,
            ask.pendingApproval,
            ask.toolEvents.length,
            turns.length,
        ]);

        // New turn started → re-enable follow mode. `ask.turnId` bumps
        // when the user fires a fresh `onAsk`; resuming a paused turn
        // does NOT bump (see hook), so approve/reject won't yank the
        // viewport away from a user reading the proposed args.
        useEffect(() => {
            userScrolledUpRef.current = false;
        }, [ask.turnId]);

        const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
            const el = e.currentTarget;
            const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
            userScrolledUpRef.current = distanceFromBottom > SCROLL_FOLLOW_THRESHOLD_PX;
        };

        // Idle hint when there's no history and nothing in-flight. Matches
        // the pre-Phase-12 placeholder so the empty-state feel is unchanged.
        if (!showHeader && !showAsk) {
            return null;
        }

        return (
            <Box
                ref={scrollRef}
                className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                sx={{
                    // Flex to fill the sheet's available height now that
                    // the input row moves to the bottom in agent mode.
                    // `minHeight: 0` lets the scroll area shrink under
                    // the sheet's `maxHeight` instead of overflowing.
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    px: 2,
                    py: 1.25,
                    background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.25,
                    // Page: the panel is a free-standing card (the
                    // overlay's sheet already frames it). Theme-reactive
                    // tokens so the card follows the active color theme.
                    ...(variant === "page"
                        ? {
                              border: "1px solid",
                              borderColor: (isDark ? purplePalette.dark : purplePalette.light)
                                  .divider,
                              borderRadius: "16px",
                              background: (isDark ? purplePalette.dark : purplePalette.light)
                                  .surfaceElevated,
                              boxShadow: isDark
                                  ? "0 12px 32px rgba(0,0,0,0.30)"
                                  : "0 12px 32px rgba(15,15,30,0.07)",
                              px: 2.5,
                              py: 2,
                              mb: 1,
                          }
                        : {}),
                }}
                onScroll={handleScroll}
            >
                {showHeader && (
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            position: "sticky",
                            top: 0,
                            py: 0.25,
                            px: 0.5,
                            borderRadius: 10,
                            // Page: match the card surface so the sticky
                            // header doesn't paint a foreign rectangle as
                            // turns scroll beneath it.
                            background:
                                variant === "page"
                                    ? (isDark ? purplePalette.dark : purplePalette.light)
                                          .surfaceSolid
                                    : isDark
                                      ? "rgba(var(--gp-dark-surface-a-rgb), 0.92)"
                                      : "rgba(250,248,255,0.96)",
                            zIndex: 1,
                        }}
                    >
                        {historyMode === "list" ? (
                            <HistoryRoundedIcon
                                sx={{ fontSize: 16, opacity: 0.7, color: "primary.500" }}
                            />
                        ) : (
                            <AutoAwesomeRoundedIcon
                                sx={{ fontSize: 16, opacity: 0.7, color: "primary.500" }}
                            />
                        )}
                        <Typography
                            level="body-sm"
                            sx={{
                                color: g.text.primary,
                                fontWeight: 600,
                                textTransform: "uppercase",
                            }}
                        >
                            {historyMode === "list"
                                ? ts.history.header
                                : historyMode === "detail"
                                  ? ts.history.detailHeader
                                  : `${ts.conversation.header}${
                                        turns.length > 0
                                            ? ` · ${fmt(ts.conversation.turnCount, { count: turns.length })}`
                                            : ""
                                    }`}
                        </Typography>
                        <Box sx={{ ml: "auto", display: "flex", alignItems: "center", gap: 0.5 }}>
                            {/* History mode buttons take over when open;
                                otherwise show the "open history" icon
                                alongside "Back to search". */}
                            {historyMode === "detail" && (
                                <AppTooltip
                                    placement="bottom"
                                    size="sm"
                                    title={ts.history.backToListTooltip}
                                >
                                    <Button
                                        color="primary"
                                        size="sm"
                                        sx={{ fontSize: "0.875rem", py: 0.25 }}
                                        variant="soft"
                                        startDecorator={
                                            <ArrowBackRoundedIcon sx={{ fontSize: 14 }} />
                                        }
                                        onClick={onBackToHistoryList}
                                    >
                                        {ts.history.backToList}
                                    </Button>
                                </AppTooltip>
                            )}
                            {historyOpen && (
                                <AppTooltip
                                    placement="bottom"
                                    size="sm"
                                    title={ts.history.closeTooltip}
                                >
                                    <IconButton
                                        color="neutral"
                                        size="sm"
                                        sx={{ minWidth: 0, p: "3px" }}
                                        variant="plain"
                                        onClick={onCloseHistory}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </AppTooltip>
                            )}
                            {!historyOpen &&
                                (turns.length > 0 || ask.sessionId || hasAskContent(ask)) && (
                                    // Visible during streaming too: ask.sessionId
                                    // only arrives on `onDone`, but the user can
                                    // already want to bail back to search the
                                    // moment they hit Enter.
                                    <AppTooltip
                                        placement="bottom"
                                        size="sm"
                                        title={ts.conversation.backToSearchTooltip}
                                    >
                                        <Button
                                            color="primary"
                                            size="sm"
                                            sx={{ fontSize: "0.875rem", py: 0.25 }}
                                            variant="soft"
                                            startDecorator={
                                                <ArrowBackRoundedIcon sx={{ fontSize: 14 }} />
                                            }
                                            onClick={onNewConversation}
                                        >
                                            {ts.actions.backToSearch}
                                        </Button>
                                    </AppTooltip>
                                )}
                        </Box>
                    </Box>
                )}

                {historyMode === "list" && (
                    <HistoryListView
                        isDark={isDark}
                        isLoading={historyIsLoading}
                        loadFailed={historyLoadFailed}
                        sessions={historySessions}
                        ts={ts}
                        onRetry={onRetryHistory}
                        onSelect={onViewHistorySession}
                    />
                )}

                {historyMode === "detail" && (
                    <HistorySessionDetailView
                        detail={historyDetail}
                        isDark={isDark}
                        isLoading={historyIsLoading}
                        ts={ts}
                        onFeedback={onFeedback}
                        onPreview={onPreview}
                    />
                )}

                {historyMode === "closed" && (
                    <>
                        {turns.map((turn) => (
                            <AgentTurn
                                key={turn.id}
                                answer={turn.answer}
                                answerSources={turn.answerSources}
                                askDisabled={askDisabled}
                                askedQuery={turn.askedQuery}
                                askError={turn.askError}
                                elapsedMs={turn.elapsedMs}
                                isCurrent={false}
                                labels={turnLabels}
                                layout={turnLayout}
                                mentions={turn.mentions}
                                noteScopes={noteScopes}
                                runId={turn.runId}
                                toolEvents={turn.toolEvents}
                                renderAnswerStatus={renderSaveAnswerStatus}
                                renderExtraActions={renderSaveAnswerActions}
                                undoSteps={turn.undo}
                                onFeedback={onFeedback}
                                onPreview={onPreview}
                                onRetry={onRetry}
                                onUndo={onUndo}
                            />
                        ))}

                        {showAsk && (
                            <AgentTurn
                                answer={ask.answer}
                                answerSources={ask.answerSources}
                                approvalEdits={ask.approvalEdits}
                                approvalFieldErrors={ask.approvalFieldErrors}
                                askDisabled={askDisabled}
                                askedQuery={ask.askedQuery}
                                askError={ask.askError}
                                elapsedMs={ask.elapsedMs}
                                isStreaming={ask.isStreaming}
                                labels={turnLabels}
                                layout={turnLayout}
                                mentions={ask.askedMentions}
                                noteScopes={noteScopes}
                                pendingApproval={ask.pendingApproval}
                                runId={ask.runId}
                                toolEvents={ask.toolEvents}
                                isCurrent
                                onApprove={onApprove}
                                onFeedback={onFeedback}
                                onPreview={onPreview}
                                onReject={onReject}
                                onRetry={onRetry}
                                renderAnswerStatus={renderSaveAnswerStatus}
                                renderExtraActions={renderSaveAnswerActions}
                                onUndo={onUndo}
                            />
                        )}
                    </>
                )}
            </Box>
        );
    }
);

// The Q&A unit itself (question, steps, answer, sources, actions) is
// `AgentTurn`, shared with the thread and note Ask modals: see its header
// for why only the turn is shared and the containers stay two. This panel
// hands it the props that keep its memo working: a stable `onRetry` (the
// hook's `onAsk` follows the draft query, so passing it straight re-rendered
// every finished turn on each query write) and `turnLabels` memoised on `t`.

// ──────────────────────────────────────────────────────────────────
// History panel views — read-only archive of past agent sessions.
//
// `HistoryListView`     — list of the user's recent sessions, hooks
//                         click → fetch detail.
// `HistorySessionDetailView` — one past session's full Q&A, rendered
//                         like the live turns but stripped of action
//                         buttons (Copy/Retry don't apply to a
//                         read-only archive).
// ──────────────────────────────────────────────────────────────────

interface HistoryListViewProps {
    sessions: AgentSessionSummary[];
    isLoading: boolean;
    // The last load failed. Rows already showing are left alone; with none,
    // the view says it couldn't load instead of "no past conversations".
    loadFailed: boolean;
    isDark: boolean;
    ts: SpotlightMessages;
    onRetry: () => void;
    onSelect: (sessionId: string) => void;
}

const HistoryListView = ({
    sessions,
    isLoading,
    loadFailed,
    isDark,
    ts,
    onRetry,
    onSelect,
}: HistoryListViewProps) => {
    if (isLoading && sessions.length === 0) {
        return <SkeletonRows count={4} label={ts.history.loading} />;
    }

    if (sessions.length === 0 && loadFailed) {
        return (
            <ErrorState
                data-error="spotlight-history"
                size="xs"
                title={ts.history.listLoadFailed}
                onRetry={onRetry}
            />
        );
    }

    if (sessions.length === 0) {
        return <EmptyState body={ts.history.empty} data-empty="spotlight-history" size="xs" />;
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 0.25 }}>
            {sessions.map((s) => (
                <Box
                    key={s.session_id}
                    component="button"
                    type="button"
                    sx={{
                        textAlign: "left",
                        background: "transparent",
                        border: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                        borderRadius: "8px",
                        px: 1.25,
                        py: 0.875,
                        cursor: "pointer",
                        font: "inherit",
                        color: g.text.primary,
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.25,
                        transition: "background 100ms ease, border-color 100ms ease",
                        "&:hover": {
                            background: isDark
                                ? "rgba(var(--gp-brandalt-400-rgb), 0.10)"
                                : "rgba(var(--gp-brand-700-rgb), 0.05)",
                            borderColor: isDark
                                ? "rgba(var(--gp-brandalt-400-rgb), 0.30)"
                                : "rgba(var(--gp-brand-700-rgb), 0.25)",
                        },
                        "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.400",
                            outlineOffset: "1px",
                        },
                    }}
                    onClick={() => onSelect(s.session_id)}
                >
                    <Typography
                        level="body-md"
                        sx={{
                            fontWeight: 500,
                            color: g.text.primary,
                            // Two-line clamp keeps the row compact when
                            // the first query is long.
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {s.first_query || ts.states.untitled}
                    </Typography>
                    <Box
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 0.75,
                            fontSize: "0.8125rem",
                            color: g.text.tertiary,
                        }}
                    >
                        <Box component="span">{_relativeTime(s.last_active_at, ts)}</Box>
                        <Box component="span" sx={{ opacity: 0.6 }}>
                            ·
                        </Box>
                        <Box component="span">
                            {fmt(ts.history.turnCount, { count: s.turn_count })}
                        </Box>
                    </Box>
                </Box>
            ))}
        </Box>
    );
};

interface HistorySessionDetailViewProps {
    detail: AgentSessionDetail | null;
    isLoading: boolean;
    isDark: boolean;
    ts: SpotlightMessages;
    // Inline citations in the archived answer open the same
    // UrlLinkModal preview that the live conversation uses, so the
    // user can deep-link from history into the actual entity. Click
    // semantics match `CitationLink` → `onPreview(source)`.
    onPreview: (s: SpotlightResult) => void;
    // F1 — archived turns carry `run_id` from the server, so past
    // answers are rateable too (the upsert makes re-votes harmless).
    onFeedback?: (runId: string, rating: number) => void;
}

const HistorySessionDetailView = ({
    detail,
    isLoading,
    isDark,
    ts,
    onPreview,
    onFeedback,
}: HistorySessionDetailViewProps) => {
    if (isLoading || detail === null) {
        if (isLoading) {
            return <SkeletonLines label={ts.history.loading} lines={4} />;
        }
        // detail === null after a failed fetch.
        return (
            <Typography
                level="body-md"
                sx={{
                    color: "danger.500",
                    opacity: 0.95,
                    px: 0.5,
                    py: 1,
                }}
            >
                {ts.history.loadFailed}
            </Typography>
        );
    }

    return (
        <Box sx={{ display: "flex", flexDirection: "column", gap: 1.25 }}>
            <Typography
                level="body-xs"
                sx={{
                    color: g.text.tertiary,
                    fontStyle: "italic",
                }}
            >
                {ts.history.readOnlyHint}
            </Typography>
            {detail.turns.map((turn) => (
                <HistoryArchiveTurn
                    key={turn.run_id}
                    isDark={isDark}
                    ts={ts}
                    turn={turn}
                    onFeedback={onFeedback}
                    onPreview={onPreview}
                />
            ))}
        </Box>
    );
};

// One past Q&A pair in the History detail view. Hosts the per-turn
// `sourcesById` and `rewriteCitations` work as hooks (which can't
// live inside the parent .map callback) and renders the answer with
// the same markdown + clickable-citation treatment the live view uses.
interface HistoryArchiveTurnProps {
    turn: AgentSessionTurn;
    isDark: boolean;
    ts: SpotlightMessages;
    onPreview: (s: SpotlightResult) => void;
    onFeedback?: (runId: string, rating: number) => void;
}

const HistoryArchiveTurn = ({
    turn,
    isDark,
    ts,
    onPreview,
    onFeedback,
}: HistoryArchiveTurnProps) => {
    // Same lookup-table shape as AgentTurn's `sourcesById` so citation
    // tokens like `[chat:dm:9:thread:4]` (whose entity_id ships
    // without the `chat:` prefix from the chunker) resolve.
    const sourcesById = useMemo(() => {
        const m = new Map<string, SpotlightResult>();
        for (const s of turn.sources) {
            const tokenKey = s.entity_id.startsWith(`${s.entity_type}:`)
                ? s.entity_id
                : `${s.entity_type}:${s.entity_id}`;
            m.set(tokenKey, s);
        }
        return m;
    }, [turn.sources]);

    const answerForRender = useMemo(
        () => rewriteCitations(turn.answer, sourcesById),
        [turn.answer, sourcesById]
    );

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                opacity: isDark ? 1 : 0.92,
            }}
        >
            {turn.query && (
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: 0.75,
                        opacity: isDark ? 1 : 0.88,
                    }}
                >
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            color: g.text.secondary,
                            minWidth: 18,
                            mt: "2px",
                        }}
                    >
                        {ts.conversation.turnLabelQ}
                    </Typography>
                    <Typography
                        level="body-md"
                        sx={{
                            fontWeight: 500,
                            whiteSpace: "pre-wrap",
                            color: g.text.primary,
                        }}
                    >
                        {turn.query}
                    </Typography>
                </Box>
            )}
            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
                <Typography
                    level="body-sm"
                    sx={{
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        opacity: isDark ? 1 : 0.75,
                        minWidth: 18,
                        mt: "2px",
                        color: "primary.500",
                    }}
                >
                    {ts.conversation.turnLabelA}
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {turn.error ? (
                        <Typography level="body-md" sx={{ color: "danger.500" }}>
                            {turn.error}
                        </Typography>
                    ) : (
                        <Box sx={markdownAnswerSx()}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    ...agentMarkdownComponents,
                                    a: ({ href, children }) => (
                                        <CitationLink
                                            href={href}
                                            sourcesById={sourcesById}
                                            onPreview={onPreview}
                                        >
                                            {children}
                                        </CitationLink>
                                    ),
                                }}
                                urlTransform={agentQAUrlTransform}
                            >
                                {answerForRender}
                            </ReactMarkdown>
                        </Box>
                    )}
                </Box>
            </Box>
            {/* F1 — rate an archived answer, once. The archive payload
                still has no rating field, but FeedbackThumbs persists the
                vote per run_id in localStorage, so a run this device
                already rated opens pre-selected + locked instead of
                inviting a re-vote. Hidden for error turns, which have no
                answer worth rating. */}
            {!turn.error && Boolean(onFeedback) && (
                <Box sx={{ display: "flex", justifyContent: "flex-end", gap: 0.25 }}>
                    <FeedbackThumbs
                        runId={turn.run_id}
                        labels={{
                            up: ts.actions.feedbackUp,
                            down: ts.actions.feedbackDown,
                        }}
                        onFeedback={onFeedback}
                    />
                </Box>
            )}
        </Box>
    );
};

// Relative-time helper for History list rows. Keeps the dependency
// surface zero (no date-fns / dayjs) — just the buckets the i18n
// bundle defines. Anything older than a day falls back to ISO date.
// Exported (as `relativeTimeLabel` below) for the Genos page's session
// sidebar, which renders the same "2h ago"-style stamps on its rows.
function _relativeTime(iso: string, ts: SpotlightMessages): string {
    const then = new Date(iso).getTime();
    if (Number.isNaN(then)) return iso;
    const deltaMs = Date.now() - then;
    if (deltaMs < 60 * 1000) return ts.history.relativeJustNow;
    const minutes = Math.floor(deltaMs / (60 * 1000));
    if (minutes < 60) return fmt(ts.history.relativeMinutes, { count: minutes });
    const hours = Math.floor(deltaMs / (60 * 60 * 1000));
    if (hours < 24) return fmt(ts.history.relativeHours, { count: hours });
    const days = Math.floor(deltaMs / (24 * 60 * 60 * 1000));
    if (days < 7) return fmt(ts.history.relativeDays, { count: days });
    // Past a week, the absolute date is more readable than "23 days
    // ago". Locale-default short date — the spotlight overlay isn't
    // i18n-strict beyond message-bundle strings today.
    return new Date(then).toLocaleDateString();
}

// eslint-disable-next-line react-refresh/only-export-components
export const relativeTimeLabel = _relativeTime;
// eslint-disable-next-line react-refresh/only-export-components
export { sourceChipLabel } from "../agentQA";
