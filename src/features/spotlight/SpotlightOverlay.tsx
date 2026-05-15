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

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import CheckRoundedIcon from "@mui/icons-material/CheckRounded";
import ContentCopyRoundedIcon from "@mui/icons-material/ContentCopyRounded";
import ReplayRoundedIcon from "@mui/icons-material/ReplayRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import { Box, Button, Chip, CircularProgress, IconButton, Sheet, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import type { AgentUsage, PendingApprovalPayload } from "../../services/agentApi";
import { purplePalette } from "../../theme/purplePalette";
import { SpotlightResultItem } from "./SpotlightResultItem";
import type { EntityType, SpotlightResult } from "./types";
import type { AskState, CompletedTurn, ToolEvent } from "./useSpotlight";

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
}

const SECTION_ORDER: { key: EntityType; label: string }[] = [
    { key: "chat", label: "Chats" },
    { key: "task", label: "Tasks" },
    { key: "note", label: "Notes" },
];

// Distance from the bottom (px) under which we consider the user
// "at the bottom" of the conversation. Streaming auto-scroll only
// fires while at-bottom; if the user has scrolled up to read history,
// we leave them in place.
const SCROLL_FOLLOW_THRESHOLD_PX = 50;
// Number of citation chips shown before the "+N more" expand button.
const CHIPS_INITIAL = 4;

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
}: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const inputRef = useRef<HTMLInputElement | null>(null);

    // Autofocus the input each time the overlay opens. Defer to next
    // tick so we don't fight the keydown that triggered the open.
    useEffect(() => {
        if (!isOpen) return;
        const t = window.setTimeout(() => inputRef.current?.focus(), 0);
        return () => window.clearTimeout(t);
    }, [isOpen]);

    const grouped = useMemo(() => {
        const byType: Record<EntityType, SpotlightResult[]> = {
            chat: [],
            task: [],
            note: [],
        };
        for (const r of results) {
            if (byType[r.entity_type]) byType[r.entity_type].push(r);
        }
        return byType;
    }, [results]);

    const askDisabled = ask.isStreaming || ask.pendingApproval !== null;
    // Show "Follow up" when there is at least one completed turn or the
    // current session is active — i.e., the user is mid-conversation.
    const hasConversation = turns.length > 0 || Boolean(ask.sessionId);

    if (!isOpen) return null;

    const trimmedQuery = query.trim();
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
                    width: "min(680px, 92vw)",
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
                            askDisabled
                                ? "Wait for the current answer to finish…"
                                : "Search chats, tasks, notes — press Enter to ask AI"
                        }
                        value={query}
                        sx={{
                            flex: 1,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            color: "inherit",
                            fontSize: "1rem",
                            fontFamily: "inherit",
                            "::placeholder": { opacity: 0.6 },
                        }}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            onQueryChange(e.target.value)
                        }
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
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
                            level="body-xs"
                            sx={{
                                whiteSpace: "nowrap",
                                fontVariantNumeric: "tabular-nums",
                                opacity:
                                    dailyUsage.used >= (dailyUsage.limit ?? Infinity) ? 1 : 0.65,
                                color:
                                    dailyUsage.used >= (dailyUsage.limit ?? Infinity)
                                        ? "warning.500"
                                        : undefined,
                            }}
                        >
                            {dailyUsage.used} / {dailyUsage.limit} asks today
                        </Typography>
                    )}
                    {ask.isStreaming && (
                        <Button
                            size="sm"
                            variant="plain"
                            color="danger"
                            onClick={onCancel}
                            sx={{ fontSize: "0.8rem", whiteSpace: "nowrap" }}
                        >
                            Cancel
                        </Button>
                    )}
                    <Button
                        color="primary"
                        disabled={!hasQuery || askDisabled}
                        size="sm"
                        startDecorator={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="solid"
                        onClick={() => onAsk()}
                    >
                        Ask
                    </Button>
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
                />

                {/* Results / states — hidden once a conversation is in
                    progress. In Q&A mode the user is talking to the
                    agent, not browsing search results. "New conversation"
                    in the conversation header returns them to search. */}
                <Box
                    sx={{
                        flex: 1,
                        overflowY: "auto",
                        px: 1,
                        py: 1,
                        display: hasConversation ? "none" : undefined,
                    }}
                >
                    {!hasQuery && (
                        <EmptyHint text="Start typing to search across chats, tasks, and notes." />
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
                            <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                                Searching…
                            </Typography>
                        </Box>
                    )}

                    {hasQuery && error && <EmptyHint text={error} tone="error" />}

                    {hasQuery && !isLoading && !error && !hasResults && (
                        <EmptyHint text="No matches yet — try different keywords." />
                    )}

                    {hasResults &&
                        SECTION_ORDER.map(({ key, label }) => {
                            const section = grouped[key];
                            if (!section || section.length === 0) return null;
                            return (
                                <Box key={key} sx={{ mb: 1.25 }}>
                                    <Typography
                                        level="body-xs"
                                        sx={{
                                            px: 1.5,
                                            pt: 0.5,
                                            pb: 0.25,
                                            opacity: 0.7,
                                            fontWeight: 600,
                                            textTransform: "uppercase",
                                            letterSpacing: "0.04em",
                                        }}
                                    >
                                        {label} ({section.length})
                                    </Typography>
                                    <Box
                                        sx={{
                                            display: "flex",
                                            flexDirection: "column",
                                            gap: 0.25,
                                        }}
                                    >
                                        {section.map((r) => (
                                            <SpotlightResultItem
                                                key={`${r.entity_type}:${r.entity_id}`}
                                                result={r}
                                                onSelect={onSelect}
                                            />
                                        ))}
                                    </Box>
                                </Box>
                            );
                        })}
                </Box>
            </Sheet>
        </Box>
    );
};

const EmptyHint = ({ text, tone }: { text: string; tone?: "error" }) => (
    <Box sx={{ px: 1.5, py: 1.25 }}>
        <Typography
            level="body-sm"
            sx={{
                opacity: tone === "error" ? 0.95 : 0.72,
                color: tone === "error" ? "danger.500" : undefined,
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
}

const hasAskContent = (ask: AskState): boolean =>
    ask.isStreaming ||
    Boolean(ask.answer) ||
    Boolean(ask.askError) ||
    ask.answerSources.length > 0 ||
    ask.toolEvents.length > 0 ||
    ask.pendingApproval !== null;

const ConversationPanel = ({
    ask,
    turns,
    isDark,
    onSelect,
    onApprove,
    onReject,
    onNewConversation,
    onAsk,
    askDisabled,
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
    }, [ask.answer, ask.isStreaming, ask.pendingApproval, ask.toolEvents.length, turns.length]);

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
        return (
            <Box
                sx={{
                    px: 2,
                    py: 1.25,
                    borderBottom: "1px solid",
                    borderColor: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.06)",
                    background: isDark ? "rgba(255,255,255,0.02)" : "rgba(0,0,0,0.015)",
                }}
            >
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 16, opacity: 0.65 }} />
                    <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                        Press Enter or click Ask for an AI-generated answer.
                    </Typography>
                </Box>
            </Box>
        );
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
                        level="body-xs"
                        sx={{ opacity: 0.85, fontWeight: 600, textTransform: "uppercase" }}
                    >
                        AI conversation
                        {turns.length > 0
                            ? ` · ${turns.length} turn${turns.length === 1 ? "" : "s"}`
                            : ""}
                    </Typography>
                    <Box sx={{ ml: "auto" }}>
                        {(turns.length > 0 || ask.sessionId) && (
                            <Button
                                size="sm"
                                variant="solid"
                                color="neutral"
                                onClick={onNewConversation}
                                sx={{ fontSize: "0.8rem", opacity: 0.75, py: 0 }}
                            >
                                New conversation
                            </Button>
                        )}
                    </Box>
                </Box>
            )}

            {turns.map((t) => (
                <TurnView
                    key={t.id}
                    askedQuery={t.askedQuery}
                    answer={t.answer}
                    answerSources={t.answerSources}
                    toolEvents={t.toolEvents}
                    askError={t.askError}
                    isCurrent={false}
                    isDark={isDark}
                    onSelect={onSelect}
                    onRetry={() => onAsk(t.askedQuery)}
                    askDisabled={askDisabled}
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
                    onRetry={() => onAsk(ask.askedQuery)}
                    askDisabled={askDisabled}
                />
            )}
        </Box>
    );
};

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
    onRetry?: () => void;
    askDisabled?: boolean;
}

const TurnView = ({
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
    onRetry,
    askDisabled,
}: TurnViewProps) => {
    const [copied, setCopied] = useState(false);
    const [showAllSources, setShowAllSources] = useState(false);

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
                opacity: isCurrent ? 1 : 0.92,
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
                        opacity: 0.88,
                    }}
                >
                    <Typography
                        level="body-xs"
                        sx={{
                            fontWeight: 700,
                            textTransform: "uppercase",
                            letterSpacing: "0.04em",
                            opacity: 0.7,
                            minWidth: 18,
                            mt: "2px",
                        }}
                    >
                        Q
                    </Typography>
                    <Typography level="body-sm" sx={{ fontWeight: 500, whiteSpace: "pre-wrap" }}>
                        {askedQuery}
                    </Typography>
                </Box>
            )}

            <Box sx={{ display: "flex", alignItems: "flex-start", gap: 0.75 }}>
                <Typography
                    level="body-xs"
                    sx={{
                        fontWeight: 700,
                        textTransform: "uppercase",
                        letterSpacing: "0.04em",
                        opacity: 0.75,
                        minWidth: 18,
                        mt: "2px",
                        color: "primary.500",
                    }}
                >
                    A
                </Typography>
                <Box sx={{ flex: 1, minWidth: 0 }}>
                    {isCurrent && isStreaming && !pendingApproval && (
                        <Box sx={{ display: "flex", alignItems: "center", gap: 0.5, mb: 0.5 }}>
                            <CircularProgress
                                size="sm"
                                sx={{ "--CircularProgress-size": "12px" }}
                            />
                            <Typography level="body-xs" sx={{ opacity: 0.75 }}>
                                streaming…
                            </Typography>
                        </Box>
                    )}
                    {isCurrent && pendingApproval && (
                        <Typography
                            level="body-xs"
                            sx={{
                                opacity: 0.85,
                                color: "warning.500",
                                fontWeight: 600,
                                mb: 0.5,
                            }}
                        >
                            awaiting your approval
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
                        />
                    )}

                    {askError && (
                        <Typography level="body-sm" sx={{ color: "danger.500", mb: 0.5 }}>
                            {askError}
                        </Typography>
                    )}

                    {answer && (
                        <Box
                            sx={{
                                lineHeight: 1.65,
                                fontSize: "0.9375rem",
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
                                    fontSize: "0.825rem",
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
                                    fontSize: "0.875rem",
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
                            <ReactMarkdown remarkPlugins={[remarkGfm]}>{answer}</ReactMarkdown>
                        </Box>
                    )}

                    {showThinking && (
                        <Typography level="body-sm" sx={{ opacity: 0.75 }}>
                            Thinking…
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
                                                fontSize: "0.78rem",
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
                                            {_chipLabel(s)}
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
                                                fontSize: "0.78rem",
                                            }}
                                        >
                                            +{hiddenCount} more
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
                                                fontSize: "0.78rem",
                                                opacity: 0.65,
                                            }}
                                        >
                                            Show less
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
                            title="Copy answer"
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
                            title="Ask again"
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
                <ToolProgressRow key={`${e.step}:${e.tool_name}`} event={e} />
            ))}
        </Box>
    );
};

const ToolProgressRow = ({ event }: { event: ToolEvent }) => {
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
                fontSize: "0.875rem",
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
                level="body-xs"
                sx={{
                    opacity: isPending ? 0.8 : 1,
                    color: isError ? "danger.500" : undefined,
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

function _chipLabel(s: SpotlightResult): string {
    const title = _titleSnippet(s.title);
    const sep = title ? `: ${title}` : "";

    if (s.entity_type === "task" && s.task_id) {
        return `task (#${s.task_id})${sep}`;
    }
    if (s.entity_type === "chat" && s.chat_id) {
        const typeLabel = s.chat_type ?? "chat";
        const base = s.thread_id
            ? `${typeLabel} (#${s.chat_id}) thread #${s.thread_id}`
            : `${typeLabel} (#${s.chat_id})`;
        return `${base}${sep}`;
    }
    if (s.entity_type === "note" && s.note_id) {
        const noteLabel = s.note_type ? `${s.note_type} note` : "note";
        return `${noteLabel} (#${s.note_id})${sep}`;
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
}

const ApprovalCard = ({ pending, isDark, onApprove, onReject }: ApprovalCardProps) => {
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
                level="body-xs"
                sx={{
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: palette.warningTint,
                    mb: 0.5,
                }}
            >
                Approval required: {pending.tool_name}
            </Typography>
            {argEntries.length > 0 && (
                <Box
                    sx={{
                        display: "flex",
                        flexDirection: "column",
                        gap: 0.15,
                        mb: 0.75,
                        fontSize: "0.875rem",
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
                    sx={{ fontSize: "0.875rem" }}
                >
                    Approve
                </Button>
                <Button
                    size="sm"
                    color="neutral"
                    variant="outlined"
                    onClick={onReject}
                    sx={{ fontSize: "0.875rem" }}
                >
                    Reject
                </Button>
            </Box>
        </Box>
    );
};
