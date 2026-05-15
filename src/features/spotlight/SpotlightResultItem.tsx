// Single row in the Spotlight results list. Renders an entity icon,
// title, snippet, and a small chunk-type chip. The whole row is a
// button — clicking calls `onSelect(result)` which the parent uses to
// navigate.

import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import { Box, Chip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import type { SpotlightResult } from "./types";

interface Props {
    result: SpotlightResult;
    isHighlighted?: boolean;
    onSelect: (r: SpotlightResult) => void;
}

const ENTITY_ICON = {
    chat: QuestionAnswerRoundedIcon,
    task: AssignmentRoundedIcon,
    note: NoteAltRoundedIcon,
};

// Friendly label shown next to the icon for context (e.g. "DM",
// "Group chat", "Personal note"). Falls back gracefully.
const subtitleFor = (r: SpotlightResult): string => {
    if (r.entity_type === "chat") {
        switch (r.chat_type) {
            case "dm":
                return "Direct message";
            case "gm":
                return "Group chat";
            case "mdm":
                return "Multi-DM";
            case "pm":
                return "Project chat";
            default:
                return "Chat";
        }
    }
    if (r.entity_type === "task") return "Task";
    if (r.entity_type === "note") {
        switch (r.note_type) {
            case "personal":
                return "Personal note";
            case "task":
                return "Task note";
            case "chat":
                return "Chat note";
            default:
                return "Note";
        }
    }
    return "";
};

export const SpotlightResultItem = ({ result, isHighlighted, onSelect }: Props) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const Icon = ENTITY_ICON[result.entity_type] ?? QuestionAnswerRoundedIcon;

    return (
        <Box
            component="button"
            type="button"
            sx={{
                display: "flex",
                alignItems: "flex-start",
                gap: 1.5,
                width: "100%",
                px: 1.5,
                py: 1.25,
                borderRadius: "10px",
                border: "1px solid transparent",
                background: isHighlighted
                    ? isDark
                        ? "rgba(255,255,255,0.06)"
                        : "rgba(0,0,0,0.04)"
                    : "transparent",
                cursor: "pointer",
                textAlign: "left",
                color: "inherit",
                font: "inherit",
                transition: "background 120ms ease",
                "&:hover": {
                    background: isDark ? "rgba(255,255,255,0.05)" : "rgba(0,0,0,0.035)",
                },
            }}
            onClick={() => onSelect(result)}
        >
            <Box
                sx={{
                    width: 32,
                    height: 32,
                    flexShrink: 0,
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                }}
            >
                <Icon sx={{ fontSize: 18, opacity: 0.75 }} />
            </Box>

            <Box sx={{ minWidth: 0, flex: 1 }}>
                <Box sx={{ display: "flex", alignItems: "baseline", gap: 1 }}>
                    <Typography
                        level="body-sm"
                        sx={{
                            fontWeight: 600,
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                        }}
                    >
                        {result.title || "(untitled)"}
                    </Typography>
                    <Typography level="body-xs" sx={{ opacity: 0.55, flexShrink: 0 }}>
                        {subtitleFor(result)}
                    </Typography>
                </Box>
                {result.snippet && (
                    <Typography
                        level="body-xs"
                        sx={{
                            mt: 0.25,
                            opacity: 0.75,
                            display: "-webkit-box",
                            WebkitLineClamp: 2,
                            WebkitBoxOrient: "vertical",
                            overflow: "hidden",
                        }}
                    >
                        {result.snippet}
                    </Typography>
                )}
                {result.matched_chunk_types.length > 0 && (
                    <Box sx={{ mt: 0.5, display: "flex", gap: 0.5, flexWrap: "wrap" }}>
                        {result.matched_chunk_types.map((ct) => (
                            <Chip key={ct} size="sm" sx={{ fontSize: "0.65rem" }} variant="soft">
                                {ct}
                            </Chip>
                        ))}
                    </Box>
                )}
            </Box>
        </Box>
    );
};
