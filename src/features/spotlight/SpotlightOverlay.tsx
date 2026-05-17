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
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
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
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { fmt, useTranslation } from "../../i18n";
import type { Messages } from "../../i18n";
import type { AgentUsage, PendingApprovalPayload } from "../../services/agentApi";
import { purplePalette } from "../../theme/purplePalette";
import {
    badgeFor,
    entitySubtitle,
    HighlightedText,
    SpotlightResultItem,
} from "./SpotlightResultItem";
import type { SpotlightResult } from "./types";
import type { AskState, CompletedTurn, ToolEvent } from "./useSpotlight";

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
}

// Distance from the bottom (px) under which we consider the user
// "at the bottom" of the conversation. Streaming auto-scroll only
// fires while at-bottom; if the user has scrolled up to read history,
// we leave them in place.
const SCROLL_FOLLOW_THRESHOLD_PX = 50;
// Number of citation chips shown before the "+N more" expand button.
const CHIPS_INITIAL = 4;

// Dark-mode text colors tuned for legibility against the translucent
// purple sheet background (rgba(30,20,46,0.92)). These replace
// opacity-based dimming, which compounds with the bg translucency to
// produce muddy, hard-to-read text.
const DARK_TEXT_STRONG = "#f1e8ff";
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
    onAsk,
    onApprove,
    onReject,
    onCancel,
    onNewConversation,
    ask,
    turns,
    dailyUsage,
    aiAnswersEnabled,
}: Props) => {
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const inputRef = useRef<HTMLInputElement | null>(null);

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
                pt: "12vh",
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
                    width: "min(700px, 92vw)",
                    maxHeight: "70vh",
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
                {/* Input row + Ask button */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        gap: 1,
                        px: 2,
                        py: 1.5,
                        borderBottom: "1px solid",
                        borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    }}
                >
                    <SearchRoundedIcon sx={{ opacity: 0.7 }} />
                    <Box
                        ref={inputRef}
                        component="input"
                        placeholder={
                            askBusy
                                ? t.spotlight.placeholder.askBusy
                                : !aiAnswersEnabled
                                  ? t.spotlight.placeholder.aiOff
                                  : hasConversation
                                    ? t.spotlight.placeholder.followUp
                                    : t.spotlight.placeholder.default
                        }
                        value={localInput}
                        sx={{
                            flex: 1,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            color: isDark ? DARK_TEXT_STRONG : "inherit",
                            fontSize: "1.0625rem",
                            fontFamily: "inherit",
                            "::placeholder": isDark
                                ? { color: DARK_TEXT_SOFT, opacity: 1 }
                                : { opacity: 0.6 },
                        }}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            handleInputChange(e.target.value)
                        }
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === "ArrowDown") {
                                if (results.length === 0) return;
                                e.preventDefault();
                                setSelectedIndex((prev) => Math.min(prev + 1, results.length - 1));
                                return;
                            }
                            if (e.key === "ArrowUp") {
                                e.preventDefault();
                                setSelectedIndex((prev) => Math.max(prev - 1, -1));
                                return;
                            }
                            if (e.key === "Enter") {
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
                    {/* Daily usage pill — hidden for unlimited users */}
                    {dailyUsage && !dailyUsage.is_unlimited && (
                        <Typography
                            level="body-sm"
                            sx={{
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
                            size="sm"
                            variant="plain"
                            color="danger"
                            onClick={onCancel}
                            sx={{ fontSize: "0.875rem", whiteSpace: "nowrap" }}
                        >
                            {t.spotlight.actions.cancel}
                        </Button>
                    )}
                    <Tooltip
                        title={!aiAnswersEnabled ? t.spotlight.errors.enableAiHint : ""}
                        // Empty title disables the tooltip in MUI Joy.
                        placement="bottom"
                        size="sm"
                        variant="outlined"
                    >
                        {/* Span wrapper lets the tooltip fire over a
                            disabled button (pointer events on a disabled
                            <button> are suppressed in Chromium). */}
                        <Box component="span" sx={{ display: "inline-flex" }}>
                            <Button
                                color="primary"
                                disabled={!hasQuery || askDisabled}
                                size="sm"
                                startDecorator={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
                                variant="solid"
                                onClick={() => onAsk()}
                            >
                                {t.spotlight.actions.ask}
                            </Button>
                        </Box>
                    </Tooltip>
                </Box>

                {/* Conversation history + current in-flight turn.
                    Rendered as a single scrollable region so past turns
                    stay readable while a new one streams in below them. */}
                <ConversationPanel
                    ask={ask}
                    turns={turns}
                    isDark={isDark}
                    onSelect={onSelect}
                    onApprove={onApprove}
                    onReject={onReject}
                    onNewConversation={onNewConversation}
                    onAsk={onAsk}
                    askDisabled={askDisabled}
                    ts={t.spotlight}
                />

                {/* Results / states — hidden once a conversation is in
                    progress. In Q&A mode the user is talking to the
                    agent, not browsing search results. "New conversation"
                    in the conversation header returns them to search. */}
                <Box
                    className={`custom-scrollbar-${isDark ? "dark" : "light"}`}
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        px: 1,
                        py: 1,
                        display: hasConversation ? "none" : undefined,
                    }}
                >
                    {!hasQuery && (
                        <EmptyHint text={t.spotlight.empty.initial} isDark={isDark} />
                    )}

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

                    {hasQuery && error && <EmptyHint text={error} tone="error" isDark={isDark} />}

                    {hasQuery && !isLoading && !error && !hasResults && (
                        <EmptyHint text={t.spotlight.empty.noMatches} isDark={isDark} />
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
                                    result={r}
                                    query={deferredQuery}
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
    onApprove: () => void;
    onReject: () => void;
    onNewConversation: () => void;
    onAsk: (overrideQuery?: string) => void;
    askDisabled: boolean;
    ts: SpotlightMessages;
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
        onApprove,
        onReject,
        onNewConversation,
        onAsk,
        askDisabled,
        ts,
    }: ConversationPanelProps) => {
        const scrollRef = useRef<HTMLDivElement | null>(null);
        // True when the user has scrolled away from the bottom. We pause
        // auto-follow until they return to the bottom themselves OR a new
        // turn starts (whichever happens first).
        const userScrolledUpRef = useRef(false);
        const rafIdRef = useRef<number | null>(null);

        const showHeader = turns.length > 0 || Boolean(ask.sessionId) || hasAskContent(ask);
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
                onScroll={handleScroll}
                sx={{
                    maxHeight: "40vh",
                    overflowY: "auto",
                    px: 2,
                    py: 1.25,
                    borderBottom: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 1.25,
                }}
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
                        <AutoAwesomeRoundedIcon
                            sx={{ fontSize: 16, opacity: 0.7, color: "primary.500" }}
                        />
                        <Typography
                            level="body-sm"
                            sx={{
                                opacity: isDark ? 1 : 0.85,
                                color: isDark ? DARK_TEXT_STRONG : undefined,
                                fontWeight: 600,
                                textTransform: "uppercase",
                            }}
                        >
                            {ts.conversation.header}
                            {turns.length > 0
                                ? ` · ${fmt(ts.conversation.turnCount, { count: turns.length })}`
                                : ""}
                        </Typography>
                        <Box sx={{ ml: "auto" }}>
                            {(turns.length > 0 || ask.sessionId) && (
                                <Tooltip
                                    title={ts.conversation.backToSearchTooltip}
                                    placement="bottom"
                                    size="sm"
                                    variant="outlined"
                                >
                                    <Button
                                        size="sm"
                                        variant="outlined"
                                        color="neutral"
                                        startDecorator={
                                            <ArrowBackRoundedIcon sx={{ fontSize: 14 }} />
                                        }
                                        onClick={onNewConversation}
                                        sx={{ fontSize: "0.875rem", py: 0.25 }}
                                    >
                                        {ts.actions.backToSearch}
                                    </Button>
                                </Tooltip>
                            )}
                        </Box>
                    </Box>
                )}

                {turns.map((turn) => (
                    <TurnView
                        key={turn.id}
                        askedQuery={turn.askedQuery}
                        answer={turn.answer}
                        answerSources={turn.answerSources}
                        toolEvents={turn.toolEvents}
                        askError={turn.askError}
                        isCurrent={false}
                        isDark={isDark}
                        onSelect={onSelect}
                        onAsk={onAsk}
                        askDisabled={askDisabled}
                        ts={ts}
                    />
                ))}

                {showAsk && (
                    <TurnView
                        askedQuery={ask.askedQuery}
                        answer={ask.answer}
                        answerSources={ask.answerSources}
                        toolEvents={ask.toolEvents}
                        askError={ask.askError}
                        isCurrent
                        isStreaming={ask.isStreaming}
                        pendingApproval={ask.pendingApproval}
                        isDark={isDark}
                        onSelect={onSelect}
                        onApprove={onApprove}
                        onReject={onReject}
                        onAsk={onAsk}
                        askDisabled={askDisabled}
                        ts={ts}
                    />
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
// "[note:personal:50]". The bracketed text must start with a known
// entity-type prefix so we don't accidentally rewrite a user's
// literal `[reminder: ship by Friday]`-style aside.
const CITATION_PATTERN = /\[((?:chat|task|note):[^\]\s]+)\]/g;

/** Replace bare `[entity_id]` citation tokens in the LLM answer with
 *  the matching source's title (or its friendly subtitle when the
 *  title is empty). Rendered as italic markdown emphasis so the
 *  reference is visually distinguishable from surrounding prose but
 *  doesn't pretend to be a clickable link — the row of source chips
 *  below the answer is the canonical click target. Tokens that don't
 *  match a known source are left untouched so users can still see
 *  what the model intended.
 *
 *  We previously rendered citations as anchors, but the required
 *  `href` placeholder ("#") resolved to "current page + #" in the
 *  browser status bar on hover, which suggested the link went to
 *  whatever page the user was on. Without a real navigable href it
 *  is clearer to drop the link affordance entirely and rely on the
 *  source-chip row for navigation.
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
        // Markdown emphasis tokens (`*`) inside the label would break
        // the wrapping italics; neutralise defensively even though
        // titles in this app are user-authored and rarely contain `*`.
        const safeLabel = label.replace(/\*/g, "");
        return `*${safeLabel}*`;
    });
}

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
    const sourcesById = useMemo(() => {
        const m = new Map<string, SpotlightResult>();
        for (const s of answerSources) m.set(s.entity_id, s);
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
                            pending={pendingApproval}
                            isDark={isDark}
                            onApprove={onApprove}
                            onReject={onReject}
                            ts={ts}
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
                                lineHeight: 1.65,
                                fontSize: "1rem",
                                color: isDark ? DARK_TEXT_STRONG : undefined,
                                mb: answerSources.length > 0 ? 0.75 : 0,
                                // paragraphs — reset default browser margins
                                "& p": { m: 0, mb: 0.75 },
                                "& p:last-child": { mb: 0 },
                                // lists
                                "& ul, & ol": { pl: 2.5, my: 0.5 },
                                "& li": { mb: 0.25 },
                                // code blocks
                                "& pre": {
                                    overflowX: "auto",
                                    borderRadius: "6px",
                                    p: 1,
                                    my: 0.75,
                                    fontSize: "0.875rem",
                                    background: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                },
                                // inline code
                                "& code": {
                                    fontFamily: "monospace",
                                    fontSize: "0.85em",
                                    px: "0.3em",
                                    py: "0.1em",
                                    borderRadius: "3px",
                                    background: isDark
                                        ? "rgba(255,255,255,0.06)"
                                        : "rgba(0,0,0,0.04)",
                                },
                                // reset code-inside-pre so the pre bg shows
                                "& pre code": { background: "none", px: 0, py: 0 },
                                // headings
                                "& h1, & h2, & h3": { mt: 1, mb: 0.5, fontWeight: 700 },
                                "& h1": { fontSize: "1.1em" },
                                "& h2": { fontSize: "1.0em" },
                                "& h3": { fontSize: "0.95em" },
                                // bold / italic
                                "& strong": { fontWeight: 700 },
                                // links
                                "& a": {
                                    color: "primary.500",
                                    textDecoration: "underline",
                                    textUnderlineOffset: "2px",
                                },
                                // blockquotes
                                "& blockquote": {
                                    borderLeft: `3px solid ${isDark ? "rgba(255,255,255,0.2)" : "rgba(0,0,0,0.18)"}`,
                                    pl: 1.5,
                                    my: 0.5,
                                    opacity: 0.85,
                                },
                                // tables (rendered by remark-gfm)
                                "& table": {
                                    borderCollapse: "collapse",
                                    width: "100%",
                                    fontSize: "0.9375rem",
                                    my: 0.75,
                                },
                                "& th, & td": {
                                    border: `1px solid ${isDark ? "rgba(255,255,255,0.12)" : "rgba(0,0,0,0.12)"}`,
                                    px: 1,
                                    py: 0.5,
                                    textAlign: "left",
                                },
                                "& th": {
                                    fontWeight: 700,
                                    background: isDark
                                        ? "rgba(255,255,255,0.04)"
                                        : "rgba(0,0,0,0.03)",
                                },
                                // horizontal rule
                                "& hr": {
                                    border: "none",
                                    borderTop: `1px solid ${isDark ? "rgba(255,255,255,0.1)" : "rgba(0,0,0,0.1)"}`,
                                    my: 1,
                                },
                            }}
                        >
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>
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
                                            size="md"
                                            variant="solid"
                                            color="primary"
                                            startDecorator={_sourceIcon(s.entity_type)}
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
                                                text={_chipLabel(s, ts)}
                                                query={askedQuery}
                                                extraTerms={s.matched_terms}
                                            />
                                        </Chip>
                                    ))}
                                    {!showAllSources && hiddenCount > 0 && (
                                        <Button
                                            size="sm"
                                            variant="plain"
                                            color="primary"
                                            onClick={() => setShowAllSources(true)}
                                            sx={{
                                                minHeight: 0,
                                                py: 0,
                                                px: 0.5,
                                                fontSize: "0.875rem",
                                            }}
                                        >
                                            {fmt(ts.actions.moreCount, { count: hiddenCount })}
                                        </Button>
                                    )}
                                    {showAllSources && answerSources.length > CHIPS_INITIAL && (
                                        <Button
                                            size="sm"
                                            variant="plain"
                                            color="neutral"
                                            onClick={() => setShowAllSources(false)}
                                            sx={{
                                                minHeight: 0,
                                                py: 0,
                                                px: 0.5,
                                                fontSize: "0.875rem",
                                                opacity: 0.65,
                                            }}
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
                            size="sm"
                            variant="plain"
                            color={copied ? "success" : "neutral"}
                            onClick={handleCopy}
                            title={ts.actions.copyAnswer}
                            sx={{ minWidth: 0, p: "3px" }}
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
                            size="sm"
                            variant="plain"
                            color="neutral"
                            disabled={askDisabled}
                            onClick={onRetry}
                            title={ts.actions.retry}
                            sx={{ minWidth: 0, p: "3px" }}
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
        return fmt(template, { subtitle, id: s.task_id, sep });
    }
    if (s.entity_type === "chat" && s.chat_id) {
        const template = badge === "thread" ? ts.chip.chatThread : ts.chip.chatPlain;
        return fmt(template, { subtitle, id: s.chat_id, sep });
    }
    if (s.entity_type === "note" && s.note_id) {
        const template = badge === "thread" ? ts.chip.noteThread : ts.chip.notePlain;
        return fmt(template, { subtitle, id: s.note_id, sep });
    }
    // Fallback to raw entity_id if specific ids are absent.
    return title ? `${s.entity_id}: ${title}` : s.entity_id;
}

function _sourceIcon(entityType: string) {
    if (entityType === "task") return <AssignmentRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "chat") return <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "note") return <StickyNote2RoundedIcon sx={{ fontSize: 13 }} />;
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
                    size="sm"
                    color="success"
                    variant="solid"
                    onClick={onApprove}
                    sx={{ fontSize: "0.9375rem" }}
                >
                    {ts.actions.approve}
                </Button>
                <Button
                    size="sm"
                    color="neutral"
                    variant="outlined"
                    onClick={onReject}
                    sx={{ fontSize: "0.9375rem" }}
                >
                    {ts.actions.reject}
                </Button>
            </Box>
        </Box>
    );
};
