// The "sources used" chip row under an answer. (The text of one chip is
// `sourceChipLabel`.)
//
// Chips are the roll-up of what the answer cited (see `citedChipSources`): the
// first four, then a "+N more" button that expands the rest. A chip reads
// "Task PRJ-12: title" in the viewer's language (the same words the Spotlight
// result rows use) with the words of the question picked out in bold.
//
// Props-only, like everything the answer turn renders: labels come in
// through `AgentTurnLabels`, a click goes out through `onOpen`.

import { useState } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Button, Chip } from "@mui/joy";

import { fmt } from "../../i18n";
import { HighlightedText } from "../spotlight/SpotlightResultItem";
import type { SpotlightResult } from "../spotlight/types";
import type { AgentTurnLabels } from "./agentTurnLabels";
import { sourceChipLabel } from "./sourceChipLabel";

// Chips shown before the "+N more" button.
const CHIPS_INITIAL = 4;

function sourceIcon(entityType: string) {
    if (entityType === "task") return <AssignmentRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "milestone") return <FlagRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "chat") return <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "note") return <StickyNote2RoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "project") return <FolderRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "todo") return <TaskAltRoundedIcon sx={{ fontSize: 13 }} />;
    return undefined;
}

interface SourceChipRowProps {
    sources: readonly SpotlightResult[];
    // The question the answer is for: its words are bolded in each chip.
    query: string;
    labels: AgentTurnLabels;
    noteScopes?: ReadonlyMap<number, "shared" | "team">;
    onOpen: (source: SpotlightResult) => void;
}

export const SourceChipRow = ({
    sources,
    query,
    labels,
    noteScopes,
    onOpen,
}: SourceChipRowProps) => {
    const [showAll, setShowAll] = useState(false);
    if (sources.length === 0) return null;
    const visible = showAll ? sources : sources.slice(0, CHIPS_INITIAL);
    const hiddenCount = sources.length - CHIPS_INITIAL;
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
                    startDecorator={sourceIcon(s.entity_type)}
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
                            boxShadow: "0 0 0 2px var(--joy-palette-primary-300)",
                            transform: "translateY(-1px)",
                        },
                    }}
                    onClick={() => onOpen(s)}
                >
                    {/* An island: a Latin source title truncates at its end in an RTL turn (MIP-1387). */}
                    <bdi className="g-bidi-island">
                        <HighlightedText
                            extraTerms={s.matched_terms}
                            query={query}
                            text={sourceChipLabel(s, labels, noteScopes)}
                        />
                    </bdi>
                </Chip>
            ))}
            {!showAll && hiddenCount > 0 && (
                <Button
                    color="primary"
                    size="sm"
                    sx={{ minHeight: 0, py: 0, px: 0.5, fontSize: "0.875rem" }}
                    variant="plain"
                    onClick={() => setShowAll(true)}
                >
                    {fmt(labels.actions.moreCount, { count: hiddenCount })}
                </Button>
            )}
            {showAll && sources.length > CHIPS_INITIAL && (
                <Button
                    color="neutral"
                    size="sm"
                    sx={{ minHeight: 0, py: 0, px: 0.5, fontSize: "0.875rem", opacity: 0.65 }}
                    variant="plain"
                    onClick={() => setShowAll(false)}
                >
                    {labels.actions.showLess}
                </Button>
            )}
        </Box>
    );
};
