// Dropdown for the agent-input @/# mention picker. Purely
// presentational — trigger detection, filtering, and keyboard state
// live in `useAgentMentionDraft`; the host input owns focus.
//
// Row look mirrors the BlockNote editors' mention menus (see `menuRow`
// in HashMention.tsx and the `@group` row in Mention.tsx): a colored
// icon disc + a bold `@`/`#` name over a muted kind subtitle, with the
// same keyboard-highlight treatment. The per-type disc colors come from
// the shared `mentionPalettes` module, so a `#task` reads the same blue
// here, in the BlockNote `#` menu, and in a message body. (This dropdown
// can't reuse the BlockNote rows directly: Spotlight mounts outside
// AvatarContext — so no `UserAvatar` — and importing those files would
// drag `@blocknote/react` into Spotlight's entry chunk.)
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
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Sheet, Typography } from "@mui/joy";
import { createPortal } from "react-dom";

import {
    CHAT_PALETTE,
    GROUP_PALETTE,
    MILESTONE_PALETTE,
    NOTE_PALETTE,
    PROJECT_PALETTE,
    TASK_PALETTE,
    TODO_PALETTE,
    USER_OTHER_PALETTE,
    type MentionPalette,
} from "../../../components/editors/mentionPalettes";
import { fmt, useTranslation, type Messages } from "../../../i18n";
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
// its consistent extension. A milestone (a task flagged `isMilestone`)
// takes the flag icon so it reads as a milestone, matching Spotlight's
// milestone chip — even though it resolves as a task on the wire.
const kindIcon = (ref: AgentMentionRef, color: string) => {
    const sx = { fontSize: 18, color };
    switch (ref.kind) {
        case "user":
            return <PersonRoundedIcon sx={sx} />;
        case "task":
            return ref.isMilestone ? (
                <FlagRoundedIcon sx={sx} />
            ) : (
                <AssignmentRoundedIcon sx={sx} />
            );
        case "note":
            return <StickyNote2RoundedIcon sx={sx} />;
        case "chat":
            return <ChatBubbleOutlineRoundedIcon sx={sx} />;
        case "project":
            return <FolderRoundedIcon sx={sx} />;
        // Same icons as the editors' @group menu (GroupRounded) and the
        // Spotlight todo citation chip (TaskAltRounded).
        case "group":
            return <GroupRoundedIcon sx={sx} />;
        case "todo":
            return <TaskAltRoundedIcon sx={sx} />;
    }
};

// The per-type identity color (shared with the message-body `#`/`@`
// chips), painted as the disc background + icon.
const kindPalette = (ref: AgentMentionRef): MentionPalette => {
    switch (ref.kind) {
        case "user":
            return USER_OTHER_PALETTE;
        case "group":
            return GROUP_PALETTE;
        case "task":
            return ref.isMilestone ? MILESTONE_PALETTE : TASK_PALETTE;
        case "note":
            return NOTE_PALETTE;
        case "chat":
            return CHAT_PALETTE;
        case "project":
            return PROJECT_PALETTE;
        case "todo":
            return TODO_PALETTE;
    }
};

// People (users, groups) get a circular disc; entities (task/note/…) get
// a rounded square — mirroring the BlockNote menus, where the `@` row is
// an avatar / circular group disc and the `#` rows are rounded squares.
const isPersonKind = (ref: AgentMentionRef): boolean =>
    ref.kind === "user" || ref.kind === "group";

// The muted second line — the entity's kind (and id, for tasks). Reuses
// the BlockNote `#` menu's wording (`common.editor.hash*`) so the two
// menus read identically. `useTranslation()` returns the English stub
// when no I18nProvider is mounted, so this is safe on every surface.
const kindSubtitle = (t: Messages, c: AgentMentionCandidate): string => {
    const e = t.common.editor;
    const { ref, subtitle } = c;
    switch (ref.kind) {
        case "user":
            return e.mentionPerson;
        case "group":
            return e.mentionGroupLabel;
        case "task": {
            // Mirror the BlockNote row: "Task · <id>" / "Milestone · <id>",
            // falling back to the raw task id when there's no display id
            // (same `displayId || taskId` rule the editor uses).
            const id = subtitle || String(ref.taskId);
            return fmt(ref.isMilestone ? e.hashMilestone : e.hashTask, { id });
        }
        case "note":
            // noteType 2 = task note, 3 = chat note, 1 = personal/shared/team
            // (the agent ref collapses those three into one code).
            return ref.noteType === 2
                ? e.hashTaskNote
                : ref.noteType === 3
                  ? e.hashChatNote
                  : e.hashNote;
        case "chat":
            // chatType 1 = DM, 2 = GM, 4 = MDM (PM/3 is filtered upstream).
            return ref.chatType === 1
                ? e.mentionDirectMessage
                : ref.chatType === 4
                  ? e.mentionMultiDm
                  : e.hashGroupChat;
        case "project":
            return e.hashProject;
        case "todo":
            return e.mentionTodo;
    }
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
    const { t } = useTranslation();
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

    // Keyboard-selected / hover row backgrounds. Light mode mirrors the
    // BlockNote menu exactly (brand-violet at 0.12 selected, 0.08 hover);
    // dark mode uses a white overlay because a brand-violet wash is
    // invisible on the dark Spotlight sheet.
    const selectedBg = isDark ? "rgba(255,255,255,0.12)" : "rgba(var(--gp-brand-700-rgb), 0.12)";
    const hoverBg = isDark ? "rgba(255,255,255,0.06)" : "rgba(var(--gp-brand-700-rgb), 0.08)";

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
                const palette = kindPalette(c.ref);
                // The violet palettes (note, todo) resolve `text` to the
                // brand var, which blends into the dark sheet — swap up
                // the ramp to the lighter alt stop, the app-wide dark
                // convention (`isDark ? brandalt-400 : brand-700`). The
                // hardcoded-hex palettes are legible on both grounds.
                const iconColor =
                    isDark && palette.text.includes("--gp-brand-700")
                        ? "var(--gp-brandalt-400)"
                        : palette.text;
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
                            minWidth: 0,
                            mx: 0.5,
                            px: 1,
                            py: 0.5,
                            borderRadius: "6px",
                            cursor: "pointer",
                            backgroundColor: highlighted ? selectedBg : "transparent",
                            transition: "background-color 0.1s ease",
                            "&:hover": {
                                backgroundColor: highlighted ? selectedBg : hoverBg,
                            },
                        }}
                        onMouseDown={(e) => {
                            e.preventDefault();
                            onSelect(c);
                        }}
                    >
                        {/* Colored identity disc: circle for people, rounded
                            square for entities — the BlockNote who/what cue. */}
                        <Box
                            sx={{
                                width: 32,
                                height: 32,
                                flexShrink: 0,
                                borderRadius: isPersonKind(c.ref) ? "50%" : "8px",
                                background: palette.bg,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                            }}
                        >
                            {kindIcon(c.ref, iconColor)}
                        </Box>
                        {/* Two-line block: `@Name` / `#Title` (bold) over the
                            kind subtitle (muted), matching the editor rows. */}
                        <Box
                            sx={{ display: "flex", flexDirection: "column", minWidth: 0, flex: 1 }}
                        >
                            <Typography
                                level="body-sm"
                                sx={{
                                    fontWeight: 600,
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    color: isDark ? "rgba(255,255,255,0.92)" : undefined,
                                }}
                            >
                                {c.trigger}
                                {c.ref.label}
                            </Typography>
                            <Typography
                                level="body-xs"
                                sx={{
                                    whiteSpace: "nowrap",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    // Light: muted primary text (BlockNote look).
                                    // Dark: an explicit muted white — stacking
                                    // opacity on Joy's light token would wash out.
                                    color: isDark ? "rgba(255,255,255,0.62)" : undefined,
                                    opacity: isDark ? 1 : 0.7,
                                }}
                            >
                                {kindSubtitle(t, c)}
                            </Typography>
                        </Box>
                    </Box>
                );
            })}
        </Sheet>,
        document.body
    );
};
