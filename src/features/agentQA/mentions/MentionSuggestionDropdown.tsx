// Dropdown for the agent-input @/# mention picker. Purely
// presentational — trigger detection, filtering, and keyboard state
// live in `useAgentMentionDraft`; the host input owns focus.
//
// Rendered through a PORTAL to document.body and positioned off the
// anchor element's viewport rect: the host surfaces clip absolutely-
// positioned children (the Spotlight sheet is `overflow: hidden`, the
// Ask modals scroll), so an in-tree menu taller than the host gets cut
// off. The portal escapes any overflow context; position re-derives on
// every render of the open menu (each keystroke) plus window resizes.
//
// `onMouseDown` (not onClick) with preventDefault keeps the textarea
// focused through the pick — same trick as the ThreadPanelV3 picker.

import { useCallback, useEffect, useLayoutEffect, useRef, useState, type RefObject } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import ChatBubbleOutlineRoundedIcon from "@mui/icons-material/ChatBubbleOutlineRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Chip, Sheet } from "@mui/joy";
import { createPortal } from "react-dom";

import type { AgentMentionCandidate, AgentMentionRef } from "./types";

// Above the Spotlight sheet (13100) and every Joy modal so the portaled
// menu is never buried under its own host surface.
const DROPDOWN_Z_INDEX = 14000;
const VIEWPORT_GUTTER = 8;
const MAX_MENU_HEIGHT = 280;

// Same icon vocabulary as the answer's citation chips (`_sourceIcon` in
// SpotlightOverlay / `sourceIcon` in SourceChips), so a mention option
// and the source chip it later becomes read as the same object. `user`
// has no citation-chip counterpart (people aren't citable) — Person is
// its consistent extension.
const kindIcon = (kind: AgentMentionRef["kind"]) => {
    switch (kind) {
        case "user":
            return <PersonRoundedIcon sx={{ fontSize: 13 }} />;
        case "task":
            return <AssignmentRoundedIcon sx={{ fontSize: 13 }} />;
        case "note":
            return <StickyNote2RoundedIcon sx={{ fontSize: 13 }} />;
        case "chat":
            return <ChatBubbleOutlineRoundedIcon sx={{ fontSize: 13 }} />;
        case "project":
            return <FolderRoundedIcon sx={{ fontSize: 13 }} />;
        // Same icons as the editors' @group menu (GroupRounded) and the
        // Spotlight todo citation chip (TaskAltRounded).
        case "group":
            return <GroupRoundedIcon sx={{ fontSize: 13 }} />;
        case "todo":
            return <TaskAltRoundedIcon sx={{ fontSize: 13 }} />;
    }
};

// Chip text mirrors the citation-chip label shape: tasks lead with the
// human-readable display id ("Task QRD-4: Title"); everything else is
// the plain title (the icon already carries the kind).
const chipLabel = (c: AgentMentionCandidate): string => {
    if (c.ref.kind === "task" && c.subtitle) return `Task ${c.subtitle}: ${c.ref.label}`;
    return c.ref.label;
};

interface MenuPos {
    left: number;
    top?: number;
    bottom?: number;
    maxWidth: number;
    maxHeight: number;
}

interface Props {
    suggestions: AgentMentionCandidate[];
    highlightIndex: number;
    onSelect: (c: AgentMentionCandidate) => void;
    // Element the menu is anchored to (the input row / input wrapper).
    anchorRef: RefObject<HTMLElement | null>;
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
    anchorRef,
    placement,
    isDark = false,
    ariaLabel,
}: Props) => {
    const [pos, setPos] = useState<MenuPos | null>(null);
    const posRef = useRef<MenuPos | null>(null);

    const measure = useCallback(() => {
        const anchor = anchorRef.current;
        if (!anchor) return;
        const r = anchor.getBoundingClientRect();
        const next: MenuPos =
            placement === "above"
                ? {
                      left: r.left,
                      bottom: window.innerHeight - r.top + 4,
                      maxWidth: Math.max(260, r.width),
                      maxHeight: Math.min(MAX_MENU_HEIGHT, Math.max(80, r.top - VIEWPORT_GUTTER)),
                  }
                : {
                      left: r.left,
                      top: r.bottom + 4,
                      maxWidth: Math.max(260, r.width),
                      maxHeight: Math.min(
                          MAX_MENU_HEIGHT,
                          Math.max(80, window.innerHeight - r.bottom - VIEWPORT_GUTTER)
                      ),
                  };
        // Equality guard: this runs on every render of the open menu,
        // so an unconditional setState would loop.
        const prev = posRef.current;
        if (
            prev &&
            prev.left === next.left &&
            prev.top === next.top &&
            prev.bottom === next.bottom &&
            prev.maxWidth === next.maxWidth &&
            prev.maxHeight === next.maxHeight
        ) {
            return;
        }
        posRef.current = next;
        setPos(next);
    }, [anchorRef, placement]);

    // Re-derive after every commit while open — the anchor moves when
    // the textarea autosizes or the host relayouts, and those coincide
    // with renders of this menu (value → suggestions recompute).
    useLayoutEffect(() => {
        measure();
    });

    useEffect(() => {
        window.addEventListener("resize", measure);
        return () => window.removeEventListener("resize", measure);
    }, [measure]);

    if (suggestions.length === 0 || !pos) {
        // First open: render nothing this commit; the layout effect
        // above sets `pos` and the menu appears on the next paint.
        return null;
    }

    return createPortal(
        <Sheet
            aria-label={ariaLabel ?? "Mention suggestions"}
            data-testid="agent-mention-dropdown"
            role="listbox"
            sx={{
                position: "fixed",
                left: pos.left,
                top: pos.top,
                bottom: pos.bottom,
                minWidth: 260,
                maxWidth: pos.maxWidth,
                maxHeight: pos.maxHeight,
                overflowY: "auto",
                zIndex: DROPDOWN_Z_INDEX,
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
                            px: 0.75,
                            py: 0.25,
                            cursor: "pointer",
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelect(c);
                        }}
                    >
                        {/* Same chip family as the answer's citation chips
                            (SourceChips soft / Spotlight solid): the
                            keyboard-highlighted row flips to solid, which
                            is both the selection indicator and a preview
                            of the chip this mention will resolve to. */}
                        <Chip
                            color="primary"
                            size="sm"
                            startDecorator={kindIcon(c.ref.kind)}
                            variant={highlighted ? "solid" : "soft"}
                            sx={{
                                pointerEvents: "none",
                                fontSize: "0.8125rem",
                                maxWidth: "100%",
                                overflow: "hidden",
                                whiteSpace: "nowrap",
                                textOverflow: "ellipsis",
                                ...(highlighted && {
                                    boxShadow: "0 0 0 2px var(--joy-palette-primary-300)",
                                }),
                            }}
                        >
                            {chipLabel(c)}
                        </Chip>
                    </Box>
                );
            })}
        </Sheet>,
        document.body
    );
};
