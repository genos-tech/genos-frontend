// Chip row rendered below a thread-Ask answer for sources the answer
// references but doesn't embed inline. The two-style rule:
//   - sources cited inline (`[chat:dm:5:thread:4]` tokens in the
//     answer text) → already rendered as title hyperlinks via
//     `rewriteCitations` + `CitationAnchor` in ThreadAskModal
//   - everything else in `answerSources` → shown here as a chip
//
// Visual style mirrors Spotlight's chip row but with `variant="soft"`
// for a calmer second-class affordance — the inline hyperlinks are the
// primary signal, these chips are "you may also want to look at…".

import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import { Box, Chip } from "@mui/joy";

import { SpotlightResult } from "../spotlight/types";

const sourceIcon = (entityType: string) => {
    if (entityType === "task") return <AssignmentRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "chat") return <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "note") return <StickyNote2RoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "project") return <FolderRoundedIcon sx={{ fontSize: 13 }} />;
    return undefined;
};

// Chip label: prefer the source's resolved title; fall back to a
// human-readable id (PRJ-42 for tasks; raw entity_id as last resort).
const chipLabel = (s: SpotlightResult): string => {
    const title = (s.title || "").trim();
    if (title) return title;
    if (s.entity_type === "task") return s.task_display_id || `Task ${s.task_id ?? ""}`;
    return s.entity_id;
};

interface SourceChipsProps {
    sources: SpotlightResult[];
    onSelectSource?: (source: SpotlightResult) => void;
}

export const SourceChips = ({ sources, onSelectSource }: SourceChipsProps) => {
    if (sources.length === 0) return null;
    return (
        <Box
            sx={{
                display: "flex",
                flexWrap: "wrap",
                gap: 0.5,
                mt: 0.75,
                alignItems: "center",
            }}
        >
            {sources.map((s) => (
                <Chip
                    key={`${s.entity_type}:${s.entity_id}`}
                    color="primary"
                    size="sm"
                    variant="soft"
                    startDecorator={sourceIcon(s.entity_type)}
                    sx={{
                        cursor: "pointer",
                        fontSize: "0.8125rem",
                        maxWidth: "min(320px, 75vw)",
                        overflow: "hidden",
                        whiteSpace: "nowrap",
                        textOverflow: "ellipsis",
                        transition: "box-shadow 0.15s, transform 0.1s",
                        "&:hover": {
                            boxShadow: "0 0 0 2px var(--joy-palette-primary-300)",
                            transform: "translateY(-1px)",
                        },
                    }}
                    onClick={() => onSelectSource?.(s)}
                >
                    {chipLabel(s)}
                </Chip>
            ))}
        </Box>
    );
};
