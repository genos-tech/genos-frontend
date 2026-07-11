// Dropdown for the agent-input @/# mention picker. Purely
// presentational — trigger detection, filtering, and keyboard state
// live in `useAgentMentionDraft`; the host input owns focus and renders
// this inside a `position: relative` wrapper.
//
// `onMouseDown` (not onClick) with preventDefault keeps the textarea
// focused through the pick — same trick as the ThreadPanelV3 picker.

import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Sheet, Typography } from "@mui/joy";

import type { AgentMentionCandidate, AgentMentionRef } from "./types";

const kindIcon = (kind: AgentMentionRef["kind"]) => {
    switch (kind) {
        case "user":
            return <PersonRoundedIcon sx={{ fontSize: 16 }} />;
        case "task":
            return <TaskAltRoundedIcon sx={{ fontSize: 16 }} />;
        case "note":
            return <StickyNote2RoundedIcon sx={{ fontSize: 16 }} />;
        case "chat":
            return <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 16 }} />;
    }
};

interface Props {
    suggestions: AgentMentionCandidate[];
    highlightIndex: number;
    onSelect: (c: AgentMentionCandidate) => void;
    // "above" for bottom-anchored inputs (chat-style agent mode),
    // "below" for top-anchored ones (Spotlight search mode).
    placement: "above" | "below";
    // Spotlight renders on a translucent dark sheet where Joy's default
    // surface tokens are illegible; the flag switches to its palette.
    isDark?: boolean;
    ariaLabel?: string;
}

export const MentionSuggestionDropdown = ({
    suggestions,
    highlightIndex,
    onSelect,
    placement,
    isDark = false,
    ariaLabel,
}: Props) => {
    if (suggestions.length === 0) return null;
    return (
        <Sheet
            aria-label={ariaLabel ?? "Mention suggestions"}
            data-testid="agent-mention-dropdown"
            role="listbox"
            sx={{
                position: "absolute",
                ...(placement === "above"
                    ? { bottom: "100%", mb: 0.5 }
                    : { top: "100%", mt: 0.5 }),
                left: 0,
                minWidth: 260,
                maxWidth: "100%",
                maxHeight: 280,
                overflowY: "auto",
                zIndex: 10,
                borderRadius: "8px",
                border: "1px solid",
                borderColor: isDark ? "rgba(255,255,255,0.12)" : "divider",
                background: isDark ? "#241a38" : undefined,
                boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
                py: 0.5,
            }}
        >
            {suggestions.map((c, i) => {
                const highlighted = i === highlightIndex;
                return (
                    <Box
                        key={c.key}
                        aria-selected={highlighted}
                        data-testid={`agent-mention-option-${c.key}`}
                        role="option"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            gap: 1,
                            px: 1.25,
                            py: 0.5,
                            cursor: "pointer",
                            background: highlighted
                                ? isDark
                                    ? "rgba(255,255,255,0.1)"
                                    : "rgba(0,0,0,0.06)"
                                : "transparent",
                            "&:hover": {
                                background: isDark ? "rgba(255,255,255,0.08)" : "rgba(0,0,0,0.04)",
                            },
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelect(c);
                        }}
                    >
                        <Box
                            sx={{
                                display: "inline-flex",
                                flexShrink: 0,
                                opacity: 0.7,
                                color: isDark ? "#cebfeb" : undefined,
                            }}
                        >
                            {kindIcon(c.ref.kind)}
                        </Box>
                        <Typography
                            level="body-sm"
                            sx={{
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                color: isDark ? "#efe9fa" : undefined,
                            }}
                        >
                            {c.ref.label}
                        </Typography>
                        {c.subtitle && (
                            <Typography
                                level="body-xs"
                                sx={{
                                    ml: "auto",
                                    flexShrink: 0,
                                    opacity: 0.6,
                                    color: isDark ? "#a89bbf" : undefined,
                                }}
                            >
                                {c.subtitle}
                            </Typography>
                        )}
                    </Box>
                );
            })}
        </Sheet>
    );
};
