// Chip row rendered below an agent answer — the "sources used" list:
// every source the answer cited (inline `[prose](type:id)` link or bare
// `[type:id]` token; see `citedChipSources`). A source cited inline
// appears both as a prose hyperlink and as a chip here.
//
// Click behaviour mirrors `CitationAnchor`: try the UrlLinkModal
// preview first (quick-look without losing the conversation), fall
// back to the caller's `onSelectSource` navigate handler when there's
// no preview — outside a UrlLinkModalProvider, no deep-link URL for
// the source, or the entity kind isn't modal-able (projects).
//
// Visual style mirrors Spotlight's chip row but with `variant="soft"`
// for a calmer second-class affordance — the inline hyperlinks are the
// primary signal, these chips are the roll-up beneath the answer.

import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Chip } from "@mui/joy";

import { useUrlLinkModal } from "../../hooks/common/UrlLinkModalContext";
import { SpotlightResult } from "../spotlight/types";
import { sourceToUrl } from "./citationUtils";

const sourceIcon = (entityType: string) => {
    if (entityType === "task") return <AssignmentRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "chat") return <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "note") return <StickyNote2RoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "project") return <FolderRoundedIcon sx={{ fontSize: 13 }} />;
    if (entityType === "todo") return <TaskAltRoundedIcon sx={{ fontSize: 13 }} />;
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
    const urlLinkModal = useUrlLinkModal();
    if (sources.length === 0) return null;
    // Same preview-first/navigate-fallback contract as CitationAnchor's
    // handleClick, so a chip and its inline-link twin behave identically.
    const handleChipClick = (s: SpotlightResult) => {
        const previewHref = sourceToUrl(s);
        if (previewHref && urlLinkModal) {
            const outcome = urlLinkModal.openModalByHref(previewHref);
            if (outcome === "opened") return;
        }
        onSelectSource?.(s);
    };
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
                    startDecorator={sourceIcon(s.entity_type)}
                    variant="soft"
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
                    onClick={() => handleChipClick(s)}
                >
                    {chipLabel(s)}
                </Chip>
            ))}
        </Box>
    );
};
