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
// surface is showing, so the input autofocuses on mount and all state
// (draft input, result highlight, mention picker) resets naturally
// when the host unmounts it. Conversation state does NOT live here —
// it belongs to `useSpotlight` at the App root, which is what lets a
// close/reopen (or an overlay→page switch) keep the conversation.
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
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import SettingsRoundedIcon from "@mui/icons-material/SettingsRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Button, Chip, CircularProgress, IconButton, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { AppTooltip } from "../../components/ui/AppTooltip";
import { fmt, useTranslation, type Messages } from "../../i18n";
import type {
    AgentSessionDetail,
    AgentSessionSummary,
    AgentSessionTurn,
    PendingApprovalPayload,
} from "../../services/agentApi";
import type { MentionGroup } from "../../services/mentionGroupsApi";
import { purplePalette } from "../../theme/purplePalette";
// Dark-mode text colors tuned for legibility against the translucent
// purple sheet background (rgba(var(--gp-dark-surface-a-rgb), 0.92)). These replace
// opacity-based dimming, which compounds with the bg translucency to
// produce muddy, hard-to-read text.
//
// `DARK_TEXT_STRONG` is re-imported from the shared markdownAnswerSx
// module (now in features/agentQA/) so the body text colour in the
// typography block stays in lock-step with every other "answer surface"
// (ThreadAskModal etc.) that renders the same theme.
import type { UserProps } from "../../types/admin";
import type { ProjectProps } from "../../types/tasks";
import {
    ApprovalCard,
    CITATION_HREF_PREFIX,
    citedChipSources,
    DARK_TEXT_STRONG,
    FeedbackThumbs,
    formatDurationMs,
    markdownAnswerSx,
    MentionHighlightOverlay,
    MentionSuggestionDropdown,
    rewriteCitations,
    ToolProgressList,
    useAgentMentionDraft,
    useAgentMentionSources,
    type AgentMentionCandidate,
    type AgentMentionRef,
    type AskState,
    type CompletedTurn,
    type ToolEvent,
} from "../agentQA";
import {
    isServiceDisabledByProjectScope,
    SPOTLIGHT_FILTER_SERVICES,
    type SpotlightFilterService,
} from "./spotlightFilters";
import { SpotlightProjectFilter, SpotlightProjectFilterSummary } from "./SpotlightProjectFilter";
import {
    badgeFor,
    entitySubtitle,
    HighlightedText,
    SpotlightResultItem,
} from "./SpotlightResultItem";
import type { SpotlightResult } from "./types";
import type { HistoryMode } from "./useSpotlight";

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
    filterProjectIds?: number[];
    onChangeFilterProjects?: (projectIds: number[]) => void;
    onSelect: (r: SpotlightResult) => void;
    // Inline citations AND source chips in the agent answer open a
    // quick-look preview (existing UrlLinkModal) on top of Spotlight
    // rather than navigating away — the user keeps their conversation.
    // (`handleSpotlightPreview` falls back to `onSelect` navigation for
    // kinds with no preview modal.) Search result rows keep `onSelect`.
    onPreview: (r: SpotlightResult) => void;
    // `mentions` carries the structured @/# refs the input's picker
    // collected for the live query (absent on retry — see useSpotlight).
    onAsk: (overrideQuery?: string, mentions?: AgentMentionRef[]) => void;
    onApprove: () => void;
    onReject: () => void;
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
    // ----- History panel (Phase ~4.6) -----
    // When `historyMode !== "closed"` the conversation panel slot
    // renders a read-only archive instead of the live `turns`/`ask`.
    // The hook owns all loading; the overlay just renders.
    historyMode: HistoryMode;
    historySessions: AgentSessionSummary[];
    historyDetail: AgentSessionDetail | null;
    historyIsLoading: boolean;
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
// Number of citation chips shown before the "+N more" expand button.
const CHIPS_INITIAL = 4;

const DARK_TEXT_MEDIUM = "#cebfeb";
const DARK_TEXT_SOFT = "#a89bbf";

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
    filterProjectIds,
    onChangeFilterProjects,
    onSelect,
    onPreview,
    onAsk,
    onApprove,
    onReject,
    onCancel,
    onNewConversation,
    onFeedback,
    ask,
    turns,
    aiAnswersEnabled,
    historyMode,
    historySessions,
    historyDetail,
    historyIsLoading,
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

    useEffect(
        () => () => {
            if (queryWriteTimerRef.current !== null) {
                window.clearTimeout(queryWriteTimerRef.current);
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
    const mentionSources = useAgentMentionSources({
        membersOverride: mentionMembers,
        groupsOverride: mentionGroups,
    });
    const mention = useAgentMentionDraft({
        value: localInput,
        onChange: handleInputChange,
        members: mentionSources.members,
        entities: mentionSources.entities,
    });
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

    // Stable click handler shared by every result row. Without this each
    // row would receive a fresh inline arrow on every keystroke and
    // memoised `SpotlightResultItem` would re-render anyway.
    const handleRowSelect = useCallback(
        (selected: SpotlightResult) => {
            setSelectedIndex(-1);
            onSelect(selected);
        },
        [onSelect]
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
                        textareaRef={inputRef}
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
                            color: isDark ? DARK_TEXT_STRONG : "inherit",
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
                            "::placeholder": isDark
                                ? { color: DARK_TEXT_SOFT, opacity: 1 }
                                : { opacity: 0.6 },
                        }}
                        onClick={syncMentionCaret}
                        onKeyUp={syncMentionCaret}
                        onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => {
                            handleInputChange(e.target.value);
                            mention.setCaret(e.target.selectionStart ?? e.target.value.length);
                        }}
                        onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
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
                                // If a result row is highlighted, navigate to
                                // it rather than firing the AI ask.
                                if (selectedIndex >= 0 && results[selectedIndex]) {
                                    onSelect(results[selectedIndex]);
                                    setSelectedIndex(-1);
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
                            color: isDark ? DARK_TEXT_SOFT : undefined,
                            opacity: isDark ? 1 : 0.6,
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
                                                  color: DARK_TEXT_MEDIUM,
                                                  backgroundColor: "rgba(255,255,255,0.07)",
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
                historyMode={historyMode}
                historySessions={historySessions}
                isDark={isDark}
                ts={t.spotlight}
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
                    // sheet. Page: it must size to content (bounded) so
                    // the host's hero layout can vertically center the
                    // input block — a flex:1 region would absorb all the
                    // free space and pin the input to the top. On the
                    // page it's also its own bordered card: free-floating
                    // rows with no container read as unfinished there
                    // (the overlay's sheet chrome provides the frame).
                    flex: variant === "page" ? "0 1 auto" : 1,
                    ...(variant === "page"
                        ? {
                              maxHeight: "48vh",
                              mt: 0.5,
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
                        <CircularProgress size="sm" />
                        <Typography
                            level="body-md"
                            sx={{
                                opacity: isDark ? 1 : 0.75,
                                color: isDark ? DARK_TEXT_MEDIUM : undefined,
                            }}
                        >
                            {t.spotlight.states.searching}
                        </Typography>
                    </Box>
                )}

                {hasQuery && error && <EmptyHint isDark={isDark} text={error} tone="error" />}

                {hasQuery && !isLoading && !error && !hasResults && (
                    <EmptyHint isDark={isDark} text={t.spotlight.empty.noMatches} />
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

const EmptyHint = ({ text, tone, isDark }: { text: string; tone?: "error"; isDark?: boolean }) => (
    <Box sx={{ px: 1.5, py: 1.25 }}>
        <Typography
            level="body-md"
            sx={{
                opacity: tone === "error" ? 0.95 : isDark ? 1 : 0.72,
                color: tone === "error" ? "danger.500" : isDark ? DARK_TEXT_MEDIUM : undefined,
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
//   2. Every completed turn from `turns` as an immutable <TurnView>.
//   3. The in-flight `ask` as a current-flagged <TurnView>, if it
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
    onApprove: () => void;
    onReject: () => void;
    onNewConversation: () => void;
    onAsk: (overrideQuery?: string) => void;
    onFeedback?: (runId: string, rating: number) => void;
    askDisabled: boolean;
    ts: SpotlightMessages;
    // History panel — when historyMode !== "closed" the panel renders
    // a read-only archive in place of turns/ask. The "open history"
    // entry point lives in the input row (always visible across modes),
    // so ConversationPanel only needs the close + back-to-list +
    // view-session callbacks here.
    historyMode: HistoryMode;
    historySessions: AgentSessionSummary[];
    historyDetail: AgentSessionDetail | null;
    historyIsLoading: boolean;
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
        onNewConversation,
        onAsk,
        onFeedback,
        askDisabled,
        ts,
        historyMode,
        historySessions,
        historyDetail,
        historyIsLoading,
        onViewHistorySession,
        onBackToHistoryList,
        onCloseHistory,
        variant = "overlay",
    }: ConversationPanelProps) => {
        const scrollRef = useRef<HTMLDivElement | null>(null);
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
                                opacity: isDark ? 1 : 0.85,
                                color: isDark ? DARK_TEXT_STRONG : undefined,
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
                        sessions={historySessions}
                        ts={ts}
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
                            <TurnView
                                key={turn.id}
                                answer={turn.answer}
                                answerSources={turn.answerSources}
                                askDisabled={askDisabled}
                                askedQuery={turn.askedQuery}
                                askError={turn.askError}
                                elapsedMs={turn.elapsedMs}
                                isCurrent={false}
                                isDark={isDark}
                                mentions={turn.mentions}
                                runId={turn.runId}
                                toolEvents={turn.toolEvents}
                                ts={ts}
                                onAsk={onAsk}
                                onFeedback={onFeedback}
                                onPreview={onPreview}
                            />
                        ))}

                        {showAsk && (
                            <TurnView
                                answer={ask.answer}
                                answerSources={ask.answerSources}
                                askDisabled={askDisabled}
                                askedQuery={ask.askedQuery}
                                askError={ask.askError}
                                elapsedMs={ask.elapsedMs}
                                isDark={isDark}
                                isStreaming={ask.isStreaming}
                                mentions={ask.askedMentions}
                                pendingApproval={ask.pendingApproval}
                                runId={ask.runId}
                                toolEvents={ask.toolEvents}
                                ts={ts}
                                isCurrent
                                onApprove={onApprove}
                                onAsk={onAsk}
                                onFeedback={onFeedback}
                                onPreview={onPreview}
                                onReject={onReject}
                            />
                        )}
                    </>
                )}
            </Box>
        );
    }
);

// ──────────────────────────────────────────────────────────────────
// TurnView — one Q&A unit
//
// Past turns (`isCurrent=false`) render statically. Current turn
// (`isCurrent=true`) additionally shows the streaming spinner, the
// "Thinking…" placeholder while the answer is empty, and the
// approval card when a write tool is paused.
// ──────────────────────────────────────────────────────────────────

interface TurnViewProps {
    askedQuery: string;
    answer: string;
    answerSources: SpotlightResult[];
    toolEvents: ToolEvent[];
    askError: string | null;
    isCurrent: boolean;
    isStreaming?: boolean;
    pendingApproval?: PendingApprovalPayload | null;
    isDark: boolean;
    // Total server-side response time from the `done` event — powers the
    // "Answered in Xs" footnote. Null/absent for error/cancelled turns
    // and against older backends (the line simply doesn't render).
    elapsedMs?: number | null;
    // Chips and inline citations share the preview handler — quick-look
    // modal on top of Spotlight, navigate fallback (see Props.onPreview).
    onPreview: (r: SpotlightResult) => void;
    onApprove?: () => void;
    onReject?: () => void;
    // The structured mentions this turn was asked with — retry re-sends
    // them so a "@Bob …" re-ask keeps its references block + boost.
    mentions?: AgentMentionRef[];
    // Pass `onAsk` rather than a pre-bound `onRetry` so the prop reference
    // stays stable across renders of `ConversationPanel`. The retry click
    // handler is composed inside `TurnView` from `onAsk` + `askedQuery`,
    // so memoised past turns aren't invalidated when the current turn
    // streams in a new `answer_delta`.
    onAsk?: (overrideQuery?: string, mentions?: AgentMentionRef[]) => void;
    askDisabled?: boolean;
    // F1 — the turn's AgentRun id (from the `done` event) + the
    // feedback submitter. Both optional: error/cancelled turns and
    // turns persisted before run_id capture have no id, and the
    // thumbs simply don't render.
    runId?: string | null;
    onFeedback?: (runId: string, rating: number) => void;
    ts: SpotlightMessages;
}

// Citation-token parsing (CITATION_PATTERN / CITATION_HREF_PREFIX /
// rewriteCitations) is the canonical implementation in
// `features/agentQA/citationUtils.ts` — imported above. SpotlightOverlay
// previously kept its own byte-identical copy (chips-only strip); they've
// now converged so the parsing rule can't drift between the two surfaces
// (SPOTLIGHT_QUALITY_ARCHITECTURE.md §4.6).

interface CitationLinkProps {
    href?: string;
    children?: React.ReactNode;
    sourcesById: Map<string, SpotlightResult>;
    onPreview: (r: SpotlightResult) => void;
    isDark: boolean;
}

/** ReactMarkdown anchor override.
 *
 *  Inspects the rendered link's href: when it starts with our
 *  `spotlight-citation:` sentinel, it renders a styled <button> that
 *  fires `onPreview(source)` on click. Any other href (the model
 *  occasionally inlines real URLs for web-search results, or markdown
 *  the user pasted) falls through to a normal external-link anchor.
 */
const CitationLink = ({ href, children, sourcesById, onPreview, isDark }: CitationLinkProps) => {
    if (href && href.startsWith(CITATION_HREF_PREFIX)) {
        const token = href.slice(CITATION_HREF_PREFIX.length);
        const source = sourcesById.get(token);
        if (source) {
            return (
                <Box
                    component="button"
                    type="button"
                    sx={{
                        // Inline-link affordance, not a chrome button.
                        background: "none",
                        border: "none",
                        p: 0,
                        cursor: "pointer",
                        font: "inherit",
                        color: isDark ? DARK_TEXT_STRONG : "primary.600",
                        textDecoration: "underline",
                        textDecorationStyle: "dotted",
                        textUnderlineOffset: "2px",
                        // Soft hover highlight to advertise interactivity.
                        borderRadius: "3px",
                        transition: "background 100ms ease",
                        "&:hover": {
                            background: isDark
                                ? "rgba(var(--gp-brandalt-400-rgb), 0.18)"
                                : "rgba(var(--gp-brand-700-rgb), 0.10)",
                            textDecorationStyle: "solid",
                        },
                        "&:focus-visible": {
                            outline: "2px solid",
                            outlineColor: "primary.400",
                            outlineOffset: "1px",
                        },
                    }}
                    onClick={() => onPreview(source)}
                >
                    {children}
                </Box>
            );
        }
        // Unresolved sentinel — shouldn't happen post-rewriteCitations,
        // but be safe: render the children plainly without an anchor.
        return <>{children}</>;
    }
    // Any other href: pass through as a normal external link.
    return (
        <a href={href} rel="noopener noreferrer" target="_blank">
            {children}
        </a>
    );
};

const TurnViewInner = ({
    askedQuery,
    answer,
    answerSources,
    toolEvents,
    askError,
    isCurrent,
    isStreaming,
    pendingApproval,
    isDark,
    elapsedMs,
    mentions,
    onPreview,
    onApprove,
    onReject,
    onAsk,
    askDisabled,
    runId,
    onFeedback,
    ts,
}: TurnViewProps) => {
    const [copied, setCopied] = useState(false);
    const [showAllSources, setShowAllSources] = useState(false);

    // Compose the retry handler from the stable `onAsk` + this turn's
    // own `askedQuery` so past turns can stay memoised across streaming
    // updates of the current turn.
    const onRetry = useCallback(() => {
        if (onAsk) onAsk(askedQuery, mentions);
    }, [onAsk, askedQuery, mentions]);

    // Look-up table for `rewriteCitations` and the `a` override below.
    // Rebuilt only when the sources array reference changes, not on
    // every streaming `answer_delta` tick.
    //
    // Citation tokens captured by `CITATION_PATTERN` are always
    // "<type>:<rest>". Task / note / project entity_ids already carry
    // that prefix; chat entity_ids do NOT (they're built as e.g.
    // "dm:9:thread:4" in the backend chunker). Normalise to the
    // prefixed form so chat citations resolve too.
    const sourcesById = useMemo(() => {
        const m = new Map<string, SpotlightResult>();
        for (const s of answerSources) {
            const tokenKey = s.entity_id.startsWith(`${s.entity_type}:`)
                ? s.entity_id
                : `${s.entity_type}:${s.entity_id}`;
            m.set(tokenKey, s);
        }
        return m;
    }, [answerSources]);

    const answerForRender = useMemo(
        () => rewriteCitations(answer, sourcesById),
        [answer, sourcesById]
    );

    // Chip row = the sources the answer cited, in either form (inline
    // `[prose](type:id)` link or bare `[type:id]` token); uncited retrieved
    // sources are dropped as noise (§4.6). An inline-cited source appears
    // both in the prose and here. `sourcesById` above is still built from
    // ALL sources so inline links still resolve.
    const chipSources = useMemo(
        () => citedChipSources(answer, answerSources),
        [answer, answerSources]
    );

    const handleCopy = useCallback(() => {
        if (!answer) return;
        navigator.clipboard
            .writeText(answer)
            .then(() => {
                setCopied(true);
                window.setTimeout(() => setCopied(false), 2000);
            })
            .catch(() => {
                /* ignore — e.g. non-secure context */
            });
    }, [answer]);

    const showThinking = isCurrent && isStreaming && !answer && !askError;
    // Show copy for any turn with answer text.
    // Show retry for past turns (always) and current turn when there's an error.
    const showCopy = Boolean(answer);
    const showRetry = Boolean(askedQuery) && (!isCurrent || Boolean(askError));
    // Thumbs (F1) need a run_id to key the POST, and only make sense on
    // a finished, non-error answer.
    const showFeedback = Boolean(runId) && Boolean(onFeedback) && !askError && !isStreaming;
    const showActions = showCopy || showRetry || showFeedback;

    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.5,
                opacity: isCurrent ? 1 : isDark ? 1 : 0.92,
                // Reveal action buttons on hover; always visible on touch devices.
                "& .turn-actions": { opacity: 0, transition: "opacity 0.15s" },
                "&:hover .turn-actions": { opacity: 1 },
                "@media (hover: none)": { "& .turn-actions": { opacity: 1 } },
            }}
        >
            {askedQuery && (
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
                            opacity: isDark ? 1 : 0.7,
                            color: isDark ? DARK_TEXT_MEDIUM : undefined,
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
                            color: isDark ? DARK_TEXT_STRONG : undefined,
                        }}
                    >
                        {askedQuery}
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
                    {isCurrent && isStreaming && !pendingApproval && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                            <CircularProgress
                                size="sm"
                                sx={{ "--CircularProgress-size": "12px" }}
                            />
                            <Typography
                                level="body-sm"
                                sx={{
                                    opacity: isDark ? 1 : 0.75,
                                    color: isDark ? DARK_TEXT_MEDIUM : undefined,
                                }}
                            >
                                {ts.states.streaming}
                            </Typography>
                        </Box>
                    )}
                    {isCurrent && pendingApproval && (
                        <Typography
                            level="body-sm"
                            sx={{
                                opacity: 0.85,
                                color: "warning.500",
                                fontWeight: 600,
                                mb: 0.5,
                            }}
                        >
                            {ts.states.awaitingApproval}
                        </Typography>
                    )}

                    {toolEvents.length > 0 && (
                        <ToolProgressList events={toolEvents} isDark={isDark} />
                    )}

                    {isCurrent && pendingApproval && onApprove && onReject && (
                        <ApprovalCard
                            approveLabel={ts.actions.approve}
                            isDark={isDark}
                            pending={pendingApproval}
                            rejectLabel={ts.actions.reject}
                            titleText={fmt(ts.approval.titleWithTool, {
                                toolName: pendingApproval.tool_name,
                            })}
                            onApprove={onApprove}
                            onReject={onReject}
                        />
                    )}

                    {askError && (
                        <Typography level="body-md" sx={{ color: "danger.500", mb: 0.5 }}>
                            {askError}
                        </Typography>
                    )}

                    {answer && (
                        <Box
                            sx={{
                                ...markdownAnswerSx(isDark),
                                mb: chipSources.length > 0 ? 0.75 : 0,
                            }}
                        >
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                // react-markdown's default `urlTransform`
                                // allow-lists http(s)/mailto/etc and strips
                                // unknown schemes — including our internal
                                // `spotlight-citation:` sentinel, which would
                                // arrive at <a> as an empty href and break
                                // the click handler. Pass through citation
                                // hrefs untouched; delegate everything else
                                // to the library default so the existing
                                // XSS guards still apply.
                                components={{
                                    a: ({ href, children }) => (
                                        <CitationLink
                                            href={href}
                                            isDark={isDark}
                                            sourcesById={sourcesById}
                                            onPreview={onPreview}
                                        >
                                            {children}
                                        </CitationLink>
                                    ),
                                }}
                                urlTransform={(url) =>
                                    url.startsWith(CITATION_HREF_PREFIX)
                                        ? url
                                        : defaultUrlTransform(url)
                                }
                            >
                                {answerForRender}
                            </ReactMarkdown>
                        </Box>
                    )}

                    {showThinking && (
                        <Typography
                            level="body-md"
                            sx={{
                                opacity: isDark ? 1 : 0.75,
                                color: isDark ? DARK_TEXT_MEDIUM : undefined,
                            }}
                        >
                            {ts.states.thinking}
                        </Typography>
                    )}

                    {chipSources.length > 0 &&
                        (() => {
                            const visible = showAllSources
                                ? chipSources
                                : chipSources.slice(0, CHIPS_INITIAL);
                            const hiddenCount = chipSources.length - CHIPS_INITIAL;
                            return (
                                <Box
                                    sx={{
                                        display: "flex",
                                        flexWrap: "wrap",
                                        gap: 0.5,
                                        mt: 0.5,
                                        alignItems: "center",
                                    }}
                                >
                                    {visible.map((s) => (
                                        <Chip
                                            key={`${s.entity_type}:${s.entity_id}`}
                                            color="primary"
                                            size="md"
                                            startDecorator={_sourceIcon(s.entity_type)}
                                            variant="solid"
                                            sx={{
                                                cursor: "pointer",
                                                fontSize: "0.875rem",
                                                maxWidth: "min(340px, 80vw)",
                                                overflow: "hidden",
                                                whiteSpace: "nowrap",
                                                textOverflow: "ellipsis",
                                                transition: "box-shadow 0.15s, transform 0.1s",
                                                "&:hover": {
                                                    boxShadow:
                                                        "0 0 0 2px var(--joy-palette-primary-300)",
                                                    transform: "translateY(-1px)",
                                                },
                                            }}
                                            onClick={() => onPreview(s)}
                                        >
                                            <HighlightedText
                                                extraTerms={s.matched_terms}
                                                query={askedQuery}
                                                text={_chipLabel(s, ts)}
                                            />
                                        </Chip>
                                    ))}
                                    {!showAllSources && hiddenCount > 0 && (
                                        <Button
                                            color="primary"
                                            size="sm"
                                            variant="plain"
                                            sx={{
                                                minHeight: 0,
                                                py: 0,
                                                px: 0.5,
                                                fontSize: "0.875rem",
                                            }}
                                            onClick={() => setShowAllSources(true)}
                                        >
                                            {fmt(ts.actions.moreCount, { count: hiddenCount })}
                                        </Button>
                                    )}
                                    {showAllSources && chipSources.length > CHIPS_INITIAL && (
                                        <Button
                                            color="neutral"
                                            size="sm"
                                            variant="plain"
                                            sx={{
                                                minHeight: 0,
                                                py: 0,
                                                px: 0.5,
                                                fontSize: "0.875rem",
                                                opacity: 0.65,
                                            }}
                                            onClick={() => setShowAllSources(false)}
                                        >
                                            {ts.actions.showLess}
                                        </Button>
                                    )}
                                </Box>
                            );
                        })()}

                    {/* Total response time (server-measured, from the
                        `done` event). Only for finished, non-error turns —
                        while streaming the spinner is the signal, and an
                        errored turn's timing is noise. */}
                    {typeof elapsedMs === "number" && !isStreaming && !askError && (
                        <Typography
                            level="body-xs"
                            sx={{
                                mt: 0.5,
                                fontVariantNumeric: "tabular-nums",
                                color: isDark ? DARK_TEXT_SOFT : undefined,
                                opacity: isDark ? 0.9 : 0.6,
                            }}
                        >
                            {fmt(ts.conversation.answeredIn, {
                                duration: formatDurationMs(elapsedMs),
                            })}
                        </Typography>
                    )}
                </Box>
            </Box>

            {/* Per-turn action bar: 👍/👎 + Copy + Retry — fades in on hover */}
            {showActions && (
                <Box
                    className="turn-actions"
                    sx={{ display: "flex", justifyContent: "flex-end", gap: 0.25, mt: 0.25 }}
                >
                    {showFeedback && (
                        <FeedbackThumbs
                            runId={runId}
                            labels={{
                                up: ts.actions.feedbackUp,
                                down: ts.actions.feedbackDown,
                            }}
                            onFeedback={onFeedback}
                        />
                    )}
                    {showCopy && (
                        <IconButton
                            color={copied ? "success" : "neutral"}
                            size="sm"
                            sx={{ minWidth: 0, p: "3px" }}
                            title={ts.actions.copyAnswer}
                            variant="plain"
                            onClick={handleCopy}
                        >
                            {copied ? (
                                <CheckRoundedIcon sx={{ fontSize: 14 }} />
                            ) : (
                                <ContentCopyRoundedIcon sx={{ fontSize: 14 }} />
                            )}
                        </IconButton>
                    )}
                    {showRetry && (
                        <IconButton
                            color="neutral"
                            disabled={askDisabled}
                            size="sm"
                            sx={{ minWidth: 0, p: "3px" }}
                            title={ts.actions.retry}
                            variant="plain"
                            onClick={onRetry}
                        >
                            <ReplayRoundedIcon sx={{ fontSize: 14 }} />
                        </IconButton>
                    )}
                </Box>
            )}
        </Box>
    );
};

TurnViewInner.displayName = "TurnView";

// Memo: prevents past turns from re-rendering on every `answer_delta`
// of the current turn. Without it, a 5-turn conversation would re-run
// `rewriteCitations` + ReactMarkdown for every prior turn on every
// token of the in-flight answer. With stable props (immutable past-turn
// snapshots) memo skips them entirely; only the current `TurnView`
// re-renders per delta.
const TurnView = memo(TurnViewInner);

// ──────────────────────────────────────────────────────────────────
// Source chip label helpers
// ──────────────────────────────────────────────────────────────────

function _titleSnippet(title: string | null, maxLen = 32): string {
    if (!title) return "";
    const t = title.trim();
    return t.length > maxLen ? t.slice(0, maxLen) + "…" : t;
}

function _chipLabel(s: SpotlightResult, ts: SpotlightMessages): string {
    const title = _titleSnippet(s.title);
    const sep = title ? `: ${title}` : "";

    // Reuse the same vocabulary the result rows use so the agent's
    // source citations don't drift from the search-result subtitles.
    // `entitySubtitle` returns e.g. "Direct message" / "Task" / "Chat
    // note"; `badgeFor` returns "thread" / "comment" / null when the
    // matched chunk was a thread reply / task comment. The full-string
    // templates in `ts.chip.*` keep composed labels translatable rather
    // than concatenating translated pieces.
    const subtitle = entitySubtitle(s, ts);
    const badge = badgeFor(s);

    if (s.entity_type === "task" && s.task_id) {
        const template = badge === "comment" ? ts.chip.taskComment : ts.chip.taskPlain;
        // Prefer human-readable PRJ-123. Falls back to the raw numeric
        // task_id only for legacy rows or tasks without a project.
        const id = s.task_display_id || s.task_id;
        return fmt(template, { subtitle, id, sep });
    }
    // Plain string (no new i18n key) — mirrors the todo branch below.
    if (s.entity_type === "milestone") {
        return title ? `Milestone${sep}${title}` : "Milestone";
    }
    if (s.entity_type === "chat" && s.chat_id) {
        const template = badge === "thread" ? ts.chip.chatThread : ts.chip.chatPlain;
        return fmt(template, { subtitle, sep });
    }
    if (s.entity_type === "note" && s.note_id) {
        const template = badge === "thread" ? ts.chip.noteThread : ts.chip.notePlain;
        return fmt(template, { subtitle, sep });
    }
    if (s.entity_type === "project" && s.project_id) {
        return fmt(ts.chip.projectPlain, { subtitle, sep });
    }
    if (s.entity_type === "todo") {
        // Parse the date out of entity_id (`todo:YYYY-MM-DD:item:<id>` or
        // `todo:YYYY-MM-DD`) for a short subtitle.
        const datePart = s.entity_id.match(/^todo:(\d{4}-\d{2}-\d{2})/)?.[1];
        const base = datePart ? `Todo · ${datePart}` : "Todo";
        return title ? `${base}${sep}${title}` : base;
    }
    // Fallback to raw entity_id if specific ids are absent.
    return title ? `${s.entity_id}: ${title}` : s.entity_id;
}

function _sourceIcon(entityType: string) {
    if (entityType === "task") return <AssignmentRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "milestone") return <FlagRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "chat") return <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "note") return <StickyNote2RoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "project") return <FolderRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "todo") return <TaskAltRoundedIcon sx={{ fontSize: 13 }} />;
    return undefined;
}

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
    isDark: boolean;
    ts: SpotlightMessages;
    onSelect: (sessionId: string) => void;
}

const HistoryListView = ({ sessions, isLoading, isDark, ts, onSelect }: HistoryListViewProps) => {
    if (isLoading && sessions.length === 0) {
        return (
            <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5, py: 1 }}>
                <CircularProgress size="sm" />
                <Typography
                    level="body-sm"
                    sx={{
                        opacity: isDark ? 1 : 0.75,
                        color: isDark ? DARK_TEXT_MEDIUM : undefined,
                    }}
                >
                    {ts.history.loading}
                </Typography>
            </Box>
        );
    }

    if (sessions.length === 0) {
        return (
            <Typography
                level="body-md"
                sx={{
                    opacity: isDark ? 1 : 0.75,
                    color: isDark ? DARK_TEXT_MEDIUM : undefined,
                    px: 0.5,
                    py: 1,
                }}
            >
                {ts.history.empty}
            </Typography>
        );
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
                        color: isDark ? DARK_TEXT_STRONG : "inherit",
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
                            color: isDark ? DARK_TEXT_STRONG : undefined,
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
                            opacity: isDark ? 0.9 : 0.65,
                            color: isDark ? DARK_TEXT_SOFT : undefined,
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
            return (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1, px: 0.5, py: 1 }}>
                    <CircularProgress size="sm" />
                    <Typography
                        level="body-sm"
                        sx={{
                            opacity: isDark ? 1 : 0.75,
                            color: isDark ? DARK_TEXT_MEDIUM : undefined,
                        }}
                    >
                        {ts.history.loading}
                    </Typography>
                </Box>
            );
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
                    opacity: isDark ? 0.85 : 0.65,
                    color: isDark ? DARK_TEXT_SOFT : undefined,
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
    // Same lookup-table shape as TurnView's `sourcesById` so citation
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
                            opacity: isDark ? 1 : 0.7,
                            color: isDark ? DARK_TEXT_MEDIUM : undefined,
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
                            color: isDark ? DARK_TEXT_STRONG : undefined,
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
                        <Box sx={markdownAnswerSx(isDark)}>
                            <ReactMarkdown
                                remarkPlugins={[remarkGfm]}
                                components={{
                                    a: ({ href, children }) => (
                                        <CitationLink
                                            href={href}
                                            isDark={isDark}
                                            sourcesById={sourcesById}
                                            onPreview={onPreview}
                                        >
                                            {children}
                                        </CitationLink>
                                    ),
                                }}
                                urlTransform={(url) =>
                                    url.startsWith(CITATION_HREF_PREFIX)
                                        ? url
                                        : defaultUrlTransform(url)
                                }
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
