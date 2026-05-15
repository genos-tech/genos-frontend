// macOS Spotlight–style global search overlay.
//
// UX:
//   - Cmd-K / Ctrl-K toggles open (wired by `useSpotlight`).
//   - Typing in the input fires debounced search-only calls. Results
//     appear in three sections (Chats / Tasks / Notes) and update live
//     as the user narrows their query.
//   - Clicking a result navigates to its existing detail view (handled
//     in the parent via `onSelect`).
//   - Pressing Enter or clicking "Ask" invokes `onAsk` — Phase 1 stub,
//     Phase 2 will dispatch a Gemini RAG call and render the answer
//     in the placeholder panel below.
//   - Escape closes (handled by the hook).
//
// Layout follows the codebase's existing overlay convention: fixed
// fullscreen container, backdrop click closes, centered MUI Joy
// `<Sheet>` at zIndex 13000+ to sit above all other surfaces. See
// `components/layout/ServiceSwitcherOverlay.tsx` for the prior art.

import { useEffect, useMemo, useRef } from "react";
import AutoAwesomeRoundedIcon from "@mui/icons-material/AutoAwesomeRounded";
import SearchRoundedIcon from "@mui/icons-material/SearchRounded";
import { Box, Button, Chip, CircularProgress, Sheet, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { SpotlightResultItem } from "./SpotlightResultItem";
import type { EntityType, SpotlightResult } from "./types";
import type { AskState } from "./useSpotlight";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    query: string;
    onQueryChange: (q: string) => void;
    results: SpotlightResult[];
    isLoading: boolean;
    error: string | null;
    onSelect: (r: SpotlightResult) => void;
    onAsk: () => void;
    ask: AskState;
}

const SECTION_ORDER: { key: EntityType; label: string }[] = [
    { key: "chat", label: "Chats" },
    { key: "task", label: "Tasks" },
    { key: "note", label: "Notes" },
];

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
    ask,
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
                    background: isDark ? "rgba(28, 28, 32, 0.92)" : "rgba(252, 252, 254, 0.96)",
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
                    <SearchRoundedIcon sx={{ opacity: 0.55 }} />
                    <Box
                        ref={inputRef}
                        component="input"
                        placeholder="Search chats, tasks, notes — press Enter to ask AI"
                        value={query}
                        sx={{
                            flex: 1,
                            border: "none",
                            outline: "none",
                            background: "transparent",
                            color: "inherit",
                            fontSize: "1rem",
                            fontFamily: "inherit",
                            "::placeholder": { opacity: 0.5 },
                        }}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            onQueryChange(e.target.value)
                        }
                        onKeyDown={(e: React.KeyboardEvent<HTMLInputElement>) => {
                            if (e.key === "Enter") {
                                e.preventDefault();
                                onAsk();
                            }
                        }}
                    />
                    <Button
                        color="primary"
                        disabled={!hasQuery}
                        size="sm"
                        startDecorator={<AutoAwesomeRoundedIcon sx={{ fontSize: 16 }} />}
                        variant="solid"
                        onClick={onAsk}
                    >
                        Ask
                    </Button>
                </Box>

                {/* AI answer panel. Empty (idle hint) until the user
                    asks; renders streaming Gemini output once invoked. */}
                <AnswerPanel ask={ask} isDark={isDark} onSelect={onSelect} />

                {/* Results / states */}
                <Box sx={{ flex: 1, overflowY: "auto", px: 1, py: 1 }}>
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
                            <Typography level="body-sm" sx={{ opacity: 0.65 }}>
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
                                            opacity: 0.55,
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
                opacity: tone === "error" ? 0.9 : 0.55,
                color: tone === "error" ? "danger.500" : undefined,
            }}
        >
            {text}
        </Typography>
    </Box>
);

interface AnswerPanelProps {
    ask: AskState;
    isDark: boolean;
    onSelect: (r: SpotlightResult) => void;
}

const AnswerPanel = ({ ask, isDark, onSelect }: AnswerPanelProps) => {
    const hasContent =
        ask.isStreaming || ask.answer || ask.askError || ask.answerSources.length > 0;

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
            {!hasContent && (
                <Box sx={{ display: "flex", alignItems: "center", gap: 1 }}>
                    <AutoAwesomeRoundedIcon sx={{ fontSize: 16, opacity: 0.5 }} />
                    <Typography level="body-xs" sx={{ opacity: 0.65 }}>
                        Press Enter or click Ask for an AI-generated answer.
                    </Typography>
                </Box>
            )}

            {hasContent && (
                <Box>
                    <Box sx={{ display: "flex", alignItems: "center", gap: 1, mb: 0.75 }}>
                        <AutoAwesomeRoundedIcon
                            sx={{ fontSize: 16, opacity: 0.7, color: "primary.500" }}
                        />
                        <Typography
                            level="body-xs"
                            sx={{ opacity: 0.7, fontWeight: 600, textTransform: "uppercase" }}
                        >
                            AI answer
                        </Typography>
                        {ask.isStreaming && (
                            <Box sx={{ display: "flex", alignItems: "center", gap: 0.5 }}>
                                <CircularProgress
                                    size="sm"
                                    sx={{ "--CircularProgress-size": "12px" }}
                                />
                                <Typography level="body-xs" sx={{ opacity: 0.55 }}>
                                    streaming…
                                </Typography>
                            </Box>
                        )}
                    </Box>

                    {ask.askError && (
                        <Typography level="body-sm" sx={{ color: "danger.500", mb: 0.5 }}>
                            {ask.askError}
                        </Typography>
                    )}

                    {ask.answer && (
                        <Typography
                            level="body-sm"
                            sx={{
                                whiteSpace: "pre-wrap",
                                lineHeight: 1.5,
                                mb: ask.answerSources.length > 0 ? 0.75 : 0,
                            }}
                        >
                            {ask.answer}
                        </Typography>
                    )}

                    {!ask.answer && ask.isStreaming && !ask.askError && (
                        <Typography level="body-sm" sx={{ opacity: 0.55 }}>
                            Thinking…
                        </Typography>
                    )}

                    {ask.answerSources.length > 0 && (
                        <Box sx={{ display: "flex", flexWrap: "wrap", gap: 0.5, mt: 0.5 }}>
                            {ask.answerSources.slice(0, 6).map((s) => (
                                <Chip
                                    key={`${s.entity_type}:${s.entity_id}`}
                                    size="sm"
                                    variant="soft"
                                    sx={{ cursor: "pointer", fontSize: "0.65rem" }}
                                    onClick={() => onSelect(s)}
                                >
                                    {s.entity_id}
                                </Chip>
                            ))}
                        </Box>
                    )}
                </Box>
            )}
        </Box>
    );
};
