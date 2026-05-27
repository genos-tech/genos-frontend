// macOS Spotlight–style global search overlay.
//
// UX:
//   - Cmd-K / Ctrl-K toggles open (wired by `useSpotlight`).
//   - Typing in the input fires debounced search-only calls. Results
//     appear in three sections (Chats / Tasks / Notes) and update live
//     as the user narrows their query.
//   - Clicking a result navigates to its existing detail view (handled
//     in the parent via `onSelect`).
//   - Pressing Enter or clicking "Ask" invokes `onAsk` which streams
//     the agent's answer.
//   - Phase 12: completed turns persist in a scrollable history above
//     the input row so the user can ask follow-up questions and read
//     prior Q&A. Ask is blocked while a turn is streaming or awaiting
//     write-tool approval.
//   - Escape closes (handled by the hook).
//
// Layout follows the codebase's existing overlay convention: fixed
// fullscreen container, backdrop click closes, centered MUI Joy
// `<Sheet>` at zIndex 13000+ to sit above all other surfaces. See
// `components/layout/ServiceSwitcherOverlay.tsx` for the prior art.

import { memo, useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import ArrowBackRoundedIcon from "@mui/icons-material/ArrowBackRounded";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import CloseRoundedIcon from "@mui/icons-material/CloseRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import HistoryRoundedIcon from "@mui/icons-material/HistoryRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import {
    Box,
    Button,
    Chip,
    CircularProgress,
    IconButton,
    Sheet,
    Tooltip,
    Typography,
} from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import ReactMarkdown, { defaultUrlTransform } from "react-markdown";
import remarkGfm from "remark-gfm";

import { fmt, useTranslation, type Messages } from "../../i18n";
import type {
    AgentSessionDetail,
    AgentSessionSummary,
    AgentSessionTurn,
    AgentUsage,
    PendingApprovalPayload,
} from "../../services/agentApi";
import { purplePalette } from "../../theme/purplePalette";
// Dark-mode text colors tuned for legibility against the translucent
// purple sheet background (rgba(30,20,46,0.92)). These replace
// opacity-based dimming, which compounds with the bg translucency to
// produce muddy, hard-to-read text.
//
// `DARK_TEXT_STRONG` is re-imported from the shared markdownAnswerSx
// module so the body text colour in the typography block stays in lock-
// step with what every other "answer surface" (ThreadAskModal etc.)
// renders.
import { DARK_TEXT_STRONG, markdownAnswerSx } from "./markdownAnswerSx";
import {
    badgeFor,
    entitySubtitle,
    HighlightedText,
    SpotlightResultItem,
} from "./SpotlightResultItem";
import type { SpotlightResult } from "./types";
import type { AskState, CompletedTurn, HistoryMode, ToolEvent } from "./useSpotlight";

type SpotlightMessages = Messages["spotlight"];

interface Props {
    isOpen: boolean;
    onClose: () => void;
    query: string;
    onQueryChange: (q: string) => void;
    results: SpotlightResult[];
    isLoading: boolean;
    error: string | null;
    onSelect: (r: SpotlightResult) => void;
    // Inline citations in the agent answer open a quick-look preview
    // (existing UrlLinkModal) on top of Spotlight rather than navigating
    // away. Source chips and result rows keep using `onSelect`.
    onPreview: (r: SpotlightResult) => void;
    onAsk: (overrideQuery?: string) => void;
    onApprove: () => void;
    onReject: () => void;
    onCancel: () => void;
    onNewConversation: () => void;
    ask: AskState;
    turns: CompletedTurn[];
    dailyUsage: AgentUsage | null;
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
}

// Distance from the bottom (px) under which we consider the user
// "at the bottom" of the conversation. Streaming auto-scroll only
// fires while at-bottom; if the user has scrolled up to read history,
// we leave them in place.
const SCROLL_FOLLOW_THRESHOLD_PX = 50;
// Number of citation chips shown before the "+N more" expand button.
const CHIPS_INITIAL = 4;

const DARK_TEXT_MEDIUM = "#cebfeb";
const DARK_TEXT_SOFT = "#a89bbf";

export const SpotlightOverlay = ({
    isOpen,
    onClose,
    query,
    onQueryChange,
    results,
    isLoading,
    error,
    onSelect,
    onPreview,
    onAsk,
    onApprove,
    onReject,
    onCancel,
    onNewConversation,
    ask,
    turns,
    dailyUsage,
    aiAnswersEnabled,
    historyMode,
    historySessions,
    historyDetail,
    historyIsLoading,
    openHistory,
    viewHistorySession,
    backToHistoryList,
    closeHistory,
}: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const inputRef = useRef<HTMLTextAreaElement | null>(null);

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

    // Autofocus the input each time the overlay opens. Defer to next
    // tick so we don't fight the keydown that triggered the open.
    useEffect(() => {
        if (!isOpen) return;
        const t = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, [isOpen]);

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

    // ---- Input performance: decouple display from heavy renders. ----
    //
    // `localInput` updates on EVERY keystroke (instant, local). It drives
    // only the input's `value` and the Ask-button-enabled check; it never
    // re-enters the hook tree.
    //
    // `onQueryChange(val)` fires immediately on every keystroke too, so
    // the hook can schedule its own debounced fetch (250 ms — see
    // `useSpotlight`). We used to add a 400 ms debounce here on top of
    // the hook's debounce, which floored typing-to-results at ~650 ms.
    // Dropping it cuts the floor to ~250 ms.
    //
    // To keep the results list smooth while `query` updates per
    // keystroke, the list reads a *deferred* copy of `query` (further
    // below). React schedules the highlight regex re-runs at low
    // priority so the input itself never stutters.
    const [localInput, setLocalInput] = useState(query);

    useEffect(() => {
        setLocalInput(query);
    }, [query]);

    const handleInputChange = useCallback(
        (val: string) => {
            setLocalInput(val);
            onQueryChange(val);
        },
        [onQueryChange]
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

    if (!isOpen) return null;

    // Use localInput for immediate UI feedback (Ask button state, empty hint).
    // `results` and other hook state still derive from the debounced `query`.
    const trimmedQuery = localInput.trim();
    const hasQuery = trimmedQuery.length > 0;
    const hasResults = results.length > 0;

    return (
        <Box
            // Backdrop. Captures clicks outside the sheet to close.
            sx={{
                position: "fixed",
                inset: 0,
                zIndex: 13100, // above ServiceSwitcherOverlay (13000)
                display: "flex",
                alignItems: "flex-start",
                justifyContent: "center",
                // Sit closer to the top on mobile so the overlay uses
                // more of the (already cramped) viewport, and clears
                // the iPhone notch / status bar.
                pt: { xs: "calc(env(safe-area-inset-top, 0px) + 12px)", sm: "12vh" },
                px: { xs: 1, sm: 0 },
                background: isDark ? "rgba(0,0,0,0.45)" : "rgba(15,15,30,0.25)",
                backdropFilter: "blur(2px)",
                WebkitBackdropFilter: "blur(2px)",
            }}
            onMouseDown={(e) => {
                if (e.target === e.currentTarget) onClose();
            }}
        >
            <Sheet
                variant="soft"
                sx={{
                    // Mobile: use nearly full width so the Ask button
                    // fits on the same row as the input + search icon.
                    // Desktop nudged up to 780px so the input still
                    // breathes after adding the History icon next to Ask.
                    width: { xs: "100%", sm: "min(780px, 92vw)" },
                    // Reserve room for the BottomTabBar so the overlay's
                    // bottom edge doesn't slide under it on mobile.
                    maxHeight: {
                        xs: "calc(100dvh - 24px - var(--BottomTabBar-height, 60px) - env(safe-area-inset-top, 0px))",
                        sm: "70vh",
                    },
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "16px",
                    backdropFilter: "blur(20px) saturate(180%)",
                    WebkitBackdropFilter: "blur(20px) saturate(180%)",
                    background: isDark ? "rgba(30,20,46,0.92)" : "rgba(250,248,255,0.96)",
                    border: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.06)",
                    boxShadow: isDark
                        ? "0 24px 60px rgba(0,0,0,0.6)"
                        : "0 24px 60px rgba(15,15,30,0.2)",
                    overflow: "hidden",
                }}
            >
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
                        sx={{
                            display: "flex",
                            // Top-align so the SearchIcon / Ask button stay
                            // anchored to the first line as the textarea
                            // grows downward.
                            alignItems: "flex-start",
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
                                // Nudge down so the icon sits on the first
                                // line's baseline instead of the textarea's
                                // top edge.
                                mt: { xs: "2px", sm: "3px" },
                            }}
                        />
                        <Box
                            ref={inputRef}
                            component="textarea"
                            value={localInput}
                            rows={1}
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
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) =>
                                handleInputChange(e.target.value)
                            }
                            onKeyDown={(e: React.KeyboardEvent<HTMLTextAreaElement>) => {
                                // Once the query spans multiple lines, the
                                // user almost certainly wants Up/Down to
                                // move the caret between lines rather than
                                // hijack focus into the result list. Fall
                                // through to the textarea's default for
                                // multi-line content; keep result-row
                                // navigation for the single-line common case.
                                const isMultiline = localInput.includes("\n");
                                if (e.key === "ArrowDown" && !isMultiline) {
                                    if (results.length === 0) return;
                                    e.preventDefault();
                                    setSelectedIndex((prev) =>
                                        Math.min(prev + 1, results.length - 1)
                                    );
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
                                    onAsk();
                                }
                            }}
                        />
                        {/* Daily usage pill — hidden for unlimited users.
                        Also hidden on mobile so the Ask button stays
                        on-row; the limit still applies, just isn't
                        chrome at 390px. */}
                        {dailyUsage && !dailyUsage.is_unlimited && (
                            <Typography
                                level="body-sm"
                                sx={{
                                    display: { xs: "none", sm: "block" },
                                    whiteSpace: "nowrap",
                                    fontVariantNumeric: "tabular-nums",
                                    opacity:
                                        dailyUsage.used >= (dailyUsage.limit ?? Infinity)
                                            ? 1
                                            : isDark
                                              ? 1
                                              : 0.65,
                                    color:
                                        dailyUsage.used >= (dailyUsage.limit ?? Infinity)
                                            ? "warning.500"
                                            : isDark
                                              ? DARK_TEXT_MEDIUM
                                              : undefined,
                                }}
                            >
                                {fmt(t.spotlight.usage.asksToday, {
                                    used: dailyUsage.used,
                                    limit: dailyUsage.limit ?? 0,
                                })}
                            </Typography>
                        )}
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
                        <Tooltip
                            size="sm"
                            variant="outlined"
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
                                    startDecorator={
                                        <AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />
                                    }
                                    variant="solid"
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
                                    onClick={() => onAsk()}
                                >
                                    <Box
                                        component="span"
                                        sx={{ display: { xs: "none", sm: "inline" } }}
                                    >
                                        {t.spotlight.actions.ask}
                                    </Box>
                                </Button>
                            </Box>
                        </Tooltip>
                        {/* History entry point — persistent across search
                        and agent modes (sits right of Ask so a returning
                        user with no live conversation in localStorage
                        can still reach their past sessions). Clicking
                        switches the panel into the History list view
                        (re-fetches once per click; bounded ≤20 rows). */}
                        <Tooltip
                            size="sm"
                            title={t.spotlight.history.openTooltip}
                            variant="outlined"
                            placement="bottom"
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
                        </Tooltip>
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
                    isDark={isDark}
                    ts={t.spotlight}
                    turns={turns}
                    historyMode={historyMode}
                    historySessions={historySessions}
                    historyDetail={historyDetail}
                    historyIsLoading={historyIsLoading}
                    onApprove={onApprove}
                    onAsk={onAsk}
                    onNewConversation={onNewConversation}
                    onPreview={onPreview}
                    onReject={onReject}
                    onSelect={onSelect}
                    onViewHistorySession={viewHistorySession}
                    onBackToHistoryList={backToHistoryList}
                    onCloseHistory={closeHistory}
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
                        flex: 1,
                        overflowY: "auto",
                        px: 1,
                        py: 1,
                        display: inAgentMode ? "none" : undefined,
                    }}
                >
                    {!hasQuery && <EmptyHint isDark={isDark} text={t.spotlight.empty.initial} />}

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
                            {results.map((r) => (
                                <SpotlightResultItem
                                    key={`${r.entity_type}:${r.entity_id}`}
                                    query={deferredQuery}
                                    result={r}
                                    isHighlighted={
                                        resultIndexOf.get(`${r.entity_type}:${r.entity_id}`) ===
                                        selectedIndex
                                    }
                                    onSelect={handleRowSelect}
                                />
                            ))}
                        </Box>
                    )}
                </Box>
            </Sheet>
        </Box>
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
    onSelect: (r: SpotlightResult) => void;
    onPreview: (r: SpotlightResult) => void;
    onApprove: () => void;
    onReject: () => void;
    onNewConversation: () => void;
    onAsk: (overrideQuery?: string) => void;
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
}

const hasAskContent = (ask: AskState): boolean =>
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
        onSelect,
        onPreview,
        onApprove,
        onReject,
        onNewConversation,
        onAsk,
        askDisabled,
        ts,
        historyMode,
        historySessions,
        historyDetail,
        historyIsLoading,
        onViewHistorySession,
        onBackToHistoryList,
        onCloseHistory,
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
                            background: isDark ? "rgba(30,20,46,0.92)" : "rgba(250,248,255,0.96)",
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
                                <Tooltip
                                    placement="bottom"
                                    size="sm"
                                    title={ts.history.backToListTooltip}
                                    variant="outlined"
                                >
                                    <Button
                                        size="sm"
                                        color="primary"
                                        sx={{ fontSize: "0.875rem", py: 0.25 }}
                                        variant="soft"
                                        startDecorator={
                                            <ArrowBackRoundedIcon sx={{ fontSize: 14 }} />
                                        }
                                        onClick={onBackToHistoryList}
                                    >
                                        {ts.history.backToList}
                                    </Button>
                                </Tooltip>
                            )}
                            {historyOpen && (
                                <Tooltip
                                    placement="bottom"
                                    size="sm"
                                    title={ts.history.closeTooltip}
                                    variant="outlined"
                                >
                                    <IconButton
                                        size="sm"
                                        color="neutral"
                                        variant="plain"
                                        sx={{ minWidth: 0, p: "3px" }}
                                        onClick={onCloseHistory}
                                    >
                                        <CloseRoundedIcon sx={{ fontSize: 16 }} />
                                    </IconButton>
                                </Tooltip>
                            )}
                            {!historyOpen &&
                                (turns.length > 0 || ask.sessionId || hasAskContent(ask)) && (
                                    // Visible during streaming too: ask.sessionId
                                    // only arrives on `onDone`, but the user can
                                    // already want to bail back to search the
                                    // moment they hit Enter.
                                    <Tooltip
                                        placement="bottom"
                                        size="sm"
                                        title={ts.conversation.backToSearchTooltip}
                                        variant="outlined"
                                    >
                                        <Button
                                            size="sm"
                                            color="primary"
                                            sx={{ fontSize: "0.875rem", py: 0.25 }}
                                            variant="soft"
                                            startDecorator={
                                                <ArrowBackRoundedIcon sx={{ fontSize: 14 }} />
                                            }
                                            onClick={onNewConversation}
                                        >
                                            {ts.actions.backToSearch}
                                        </Button>
                                    </Tooltip>
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
                                isCurrent={false}
                                isDark={isDark}
                                toolEvents={turn.toolEvents}
                                ts={ts}
                                onAsk={onAsk}
                                onPreview={onPreview}
                                onSelect={onSelect}
                            />
                        ))}

                        {showAsk && (
                            <TurnView
                                answer={ask.answer}
                                answerSources={ask.answerSources}
                                askDisabled={askDisabled}
                                askedQuery={ask.askedQuery}
                                askError={ask.askError}
                                isDark={isDark}
                                isStreaming={ask.isStreaming}
                                pendingApproval={ask.pendingApproval}
                                toolEvents={ask.toolEvents}
                                ts={ts}
                                isCurrent
                                onApprove={onApprove}
                                onAsk={onAsk}
                                onPreview={onPreview}
                                onReject={onReject}
                                onSelect={onSelect}
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
    onSelect: (r: SpotlightResult) => void;
    onPreview: (r: SpotlightResult) => void;
    onApprove?: () => void;
    onReject?: () => void;
    // Pass `onAsk` rather than a pre-bound `onRetry` so the prop reference
    // stays stable across renders of `ConversationPanel`. The retry click
    // handler is composed inside `TurnView` from `onAsk` + `askedQuery`,
    // so memoised past turns aren't invalidated when the current turn
    // streams in a new `answer_delta`.
    onAsk?: (overrideQuery?: string) => void;
    askDisabled?: boolean;
    ts: SpotlightMessages;
}

// Matches the citation tokens the prompt (`prompts.py`) instructs the
// model to emit: one or more colon-separated segments inside square
// brackets, e.g. "[task:123]", "[chat:pm:1:thread:3]",
// "[note:personal:50]", "[project:5]". The bracketed text must start
// with a known entity-type prefix so we don't accidentally rewrite a
// user's literal `[reminder: ship by Friday]`-style aside.
const CITATION_PATTERN = /\[((?:chat|task|note|project):[^\]\s]+)\]/g;

// Internal href scheme used by `rewriteCitations` so the ReactMarkdown
// `a` override can recognise an inline citation and trigger the preview
// modal instead of navigating. Format: "spotlight-citation:<token>"
// where <token> is the same string the citation regex captures.
const CITATION_HREF_PREFIX = "spotlight-citation:";

/** Replace bare `[entity_id]` citation tokens in the LLM answer with
 *  a markdown link whose label is the matching source's title (or its
 *  friendly subtitle when the title is empty) and whose href uses our
 *  `spotlight-citation:` sentinel scheme. The ReactMarkdown `a` override
 *  intercepts that scheme and opens a preview modal on click (see
 *  `CitationLink`). Tokens that don't match a known source are left
 *  untouched so users can still see what the model intended.
 *
 *  The label is wrapped in markdown emphasis (`*...*`) to keep the
 *  visual cadence of the prior italic-only treatment while adding the
 *  clickable affordance.
 */
function rewriteCitations(
    answer: string,
    sourcesById: Map<string, SpotlightResult>,
    ts: SpotlightMessages
): string {
    if (!answer || sourcesById.size === 0) return answer;
    return answer.replace(CITATION_PATTERN, (match, entityId: string) => {
        const source = sourcesById.get(entityId);
        if (!source) return match;
        const label = (source.title || "").trim() || entitySubtitle(source, ts);
        // Escape markdown link/emphasis controls that would break parsing:
        //   * — closes the wrapping emphasis early
        //   [ ] — interpreted as a link label
        //   ( ) — interpreted as a link target boundary
        const safeLabel = label.replace(/[*[\]()]/g, "");
        return `[*${safeLabel}*](${CITATION_HREF_PREFIX}${entityId})`;
    });
}

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
                                ? "rgba(167,139,250,0.18)"
                                : "rgba(124,58,237,0.10)",
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
    onSelect,
    onPreview,
    onApprove,
    onReject,
    onAsk,
    askDisabled,
    ts,
}: TurnViewProps) => {
    const [copied, setCopied] = useState(false);
    const [showAllSources, setShowAllSources] = useState(false);

    // Compose the retry handler from the stable `onAsk` + this turn's
    // own `askedQuery` so past turns can stay memoised across streaming
    // updates of the current turn.
    const onRetry = useCallback(() => {
        if (onAsk) onAsk(askedQuery);
    }, [onAsk, askedQuery]);

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
        () => rewriteCitations(answer, sourcesById, ts),
        [answer, sourcesById, ts]
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
    const showActions = showCopy || showRetry;

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
                            isDark={isDark}
                            pending={pendingApproval}
                            ts={ts}
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
                                mb: answerSources.length > 0 ? 0.75 : 0,
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

                    {answerSources.length > 0 &&
                        (() => {
                            const visible = showAllSources
                                ? answerSources
                                : answerSources.slice(0, CHIPS_INITIAL);
                            const hiddenCount = answerSources.length - CHIPS_INITIAL;
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
                                            onClick={() => onSelect(s)}
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
                                    {showAllSources && answerSources.length > CHIPS_INITIAL && (
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
                </Box>
            </Box>

            {/* Per-turn action bar: Copy + Retry — fades in on hover */}
            {showActions && (
                <Box
                    className="turn-actions"
                    sx={{ display: "flex", justifyContent: "flex-end", gap: 0.25, mt: 0.25 }}
                >
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
// ToolProgressList — Phase 3 agent activity strip
//
// Renders the agent's per-step tool calls above the final answer.
// Pending steps show a small spinner; completed steps show ✓ and the
// short summary the backend produced; failed steps show ✗ + the error.
// Hidden when no events exist (so single-step answers stay clean).
// ──────────────────────────────────────────────────────────────────

interface ToolProgressListProps {
    events: ToolEvent[];
    isDark: boolean;
}

const ToolProgressList = ({ events, isDark }: ToolProgressListProps) => {
    return (
        <Box
            sx={{
                display: "flex",
                flexDirection: "column",
                gap: 0.25,
                mb: 0.75,
                pl: 0.25,
                borderLeft: "2px solid",
                borderColor: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.08)",
                pl_: 1,
            }}
        >
            {events.map((e) => (
                <ToolProgressRow key={`${e.step}:${e.tool_name}`} event={e} isDark={isDark} />
            ))}
        </Box>
    );
};

const ToolProgressRow = ({ event, isDark }: { event: ToolEvent; isDark: boolean }) => {
    const isPending = event.status === "pending";
    const isError = event.status === "error";

    const label = event.summary || _humanReadableCall(event);

    return (
        <Box
            sx={{
                display: "flex",
                alignItems: "center",
                gap: 0.75,
                pl: 1,
                py: 0.25,
                fontSize: "0.9375rem",
            }}
        >
            {isPending && (
                <CircularProgress size="sm" sx={{ "--CircularProgress-size": "11px" }} />
            )}
            {!isPending && !isError && (
                <Box
                    component="span"
                    sx={{ color: "success.500", fontWeight: 700, width: 14, textAlign: "center" }}
                >
                    ✓
                </Box>
            )}
            {isError && (
                <Box
                    component="span"
                    sx={{ color: "danger.500", fontWeight: 700, width: 14, textAlign: "center" }}
                >
                    ✗
                </Box>
            )}
            <Typography
                level="body-sm"
                sx={{
                    opacity: isPending ? (isDark ? 1 : 0.8) : 1,
                    color: isError
                        ? "danger.500"
                        : isDark
                          ? isPending
                              ? DARK_TEXT_MEDIUM
                              : DARK_TEXT_STRONG
                          : undefined,
                }}
            >
                {isError ? `${event.tool_name}: ${event.error}` : label}
            </Typography>
        </Box>
    );
};

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
    // Fallback to raw entity_id if specific ids are absent.
    return title ? `${s.entity_id}: ${title}` : s.entity_id;
}

function _sourceIcon(entityType: string) {
    if (entityType === "task") return <AssignmentRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "chat") return <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "note") return <StickyNote2RoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "project") return <FolderRoundedIcon sx={{ fontSize: 13 }} />;
    return undefined;
}

// Fallback label for a still-pending tool call (no summary yet).
function _humanReadableCall(e: ToolEvent): string {
    const argPreview =
        Object.keys(e.arguments).length > 0
            ? Object.entries(e.arguments)
                  .slice(0, 2)
                  .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                  .join(", ")
            : "";
    return argPreview ? `${e.tool_name}(${argPreview})` : e.tool_name;
}

// ──────────────────────────────────────────────────────────────────
// ApprovalCard — Phase 7 write-tool gate
//
// Rendered when the agent loop has paused on a tool flagged
// `requires_approval=True` (currently `create_task`, `update_task`,
// `add_comment`, `create_note`). Shows the tool name + the arguments
// the model proposed, and offers Approve / Reject buttons that call
// back into the hook. Either choice resumes the same stream via
// POST /api/v2/agent/decide/.
// ──────────────────────────────────────────────────────────────────

interface ApprovalCardProps {
    pending: PendingApprovalPayload;
    isDark: boolean;
    onApprove: () => void;
    onReject: () => void;
    ts: SpotlightMessages;
}

const ApprovalCard = ({ pending, isDark, onApprove, onReject, ts }: ApprovalCardProps) => {
    const argEntries = Object.entries(pending.arguments || {});
    const palette = isDark ? purplePalette.dark : purplePalette.light;
    return (
        <Box
            sx={{
                mt: 0.75,
                mb: 0.75,
                px: 1.25,
                py: 1,
                borderRadius: "10px",
                border: "1px solid",
                borderColor: palette.warningTintBorder,
                background: palette.warningTintBg,
            }}
        >
            <Typography
                level="body-sm"
                sx={{
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: palette.warningTint,
                    mb: 0.5,
                }}
            >
                {fmt(ts.approval.titleWithTool, { toolName: pending.tool_name })}
            </Typography>
            {argEntries.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.15,
                        mb: 0.75,
                        fontSize: "0.9375rem",
                        fontFamily: "monospace",
                        opacity: 0.9,
                    }}
                >
                    {argEntries.map(([k, v]) => (
                        <Box key={k} sx={{ display: "flex", gap: 0.5 }}>
                            <Box component="span" sx={{ opacity: 0.8 }}>
                                {k}:
                            </Box>
                            <Box component="span" sx={{ flex: 1, wordBreak: "break-word" }}>
                                {typeof v === "string" ? v : JSON.stringify(v)}
                            </Box>
                        </Box>
                    ))}
                </Box>
            )}
            <Box sx={{ display: "flex", gap: 0.75 }}>
                <Button
                    color="success"
                    size="sm"
                    sx={{ fontSize: "0.9375rem" }}
                    variant="solid"
                    onClick={onApprove}
                >
                    {ts.actions.approve}
                </Button>
                <Button
                    color="neutral"
                    size="sm"
                    sx={{ fontSize: "0.9375rem" }}
                    variant="outlined"
                    onClick={onReject}
                >
                    {ts.actions.reject}
                </Button>
            </Box>
        </Box>
    );
};

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
                                ? "rgba(167,139,250,0.10)"
                                : "rgba(124,58,237,0.05)",
                            borderColor: isDark
                                ? "rgba(167,139,250,0.30)"
                                : "rgba(124,58,237,0.25)",
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
}

const HistorySessionDetailView = ({
    detail,
    isLoading,
    isDark,
    ts,
    onPreview,
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
                    onPreview={onPreview}
                    ts={ts}
                    turn={turn}
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
}

const HistoryArchiveTurn = ({ turn, isDark, ts, onPreview }: HistoryArchiveTurnProps) => {
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
        () => rewriteCitations(turn.answer, sourcesById, ts),
        [turn.answer, sourcesById, ts]
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
        </Box>
    );
};

// Relative-time helper for History list rows. Keeps the dependency
// surface zero (no date-fns / dayjs) — just the buckets the i18n
// bundle defines. Anything older than a day falls back to ISO date.
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
