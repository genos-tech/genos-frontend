// Dropdown for the agent-input @/# mention picker. Purely
// presentational — trigger detection, filtering, and keyboard state
// live in `useAgentMentionDraft`; the host input owns focus.
//
// Rows are the SHARED `MentionMenuRow` the BlockNote editors' mention
// menus use, so a `#task` row here is the same row it is in the editor:
// same icon vocabulary (`MENTION_ICONS`), same palettes, same trailing
// status chip, same email/"YOU"/custom-status treatment on a person. The
// editor menus are the reference look; this menu follows them by
// construction rather than by re-description, which is how the two used
// to drift (a task was an assignment clipboard here and a check circle
// there).
//
// The one thing that stays local is the identity visual for a person:
// Spotlight mounts outside AvatarContext, so `UserAvatar` — which throws
// without its provider — is unavailable, and the row instead gets a bare
// Joy `<Avatar src>` built context-free from the candidate's
// `avatarImgPath` via `buildAvatarSrc`. (Importing the editor files
// wholesale would also drag `@blocknote/react` into Spotlight's entry
// chunk; `mentionMenuRow` and `mentionPalettes` are BlockNote-free
// precisely so this menu can share them.) Everything a row shows beyond
// the ref itself rides on the candidate — see the row-detail fields on
// `AgentMentionCandidate`.
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
import { Avatar, Box, Sheet } from "@mui/joy";
import { createPortal } from "react-dom";

import {
    MENTION_ICONS,
    MentionCountChip,
    MentionCustomStatus,
    MentionIconDisc,
    MentionMenuRow,
    MentionSelfChip,
} from "../../../components/editors/mentionMenuRow";
import {
    CHAT_PALETTE,
    GROUP_PALETTE,
    MILESTONE_PALETTE,
    NOTE_PALETTE,
    PROJECT_PALETTE,
    TASK_PALETTE,
    TODO_PALETTE,
    type MentionPalette,
} from "../../../components/editors/mentionPalettes";
import { fmt, useTranslation, type Messages } from "../../../i18n";
import { buildAvatarSrc } from "../../../utils/avatarSrc";
import { TaskStatusChip } from "../../tasks/components/TaskStatusChip";
import type { AgentMentionCandidate, AgentMentionRef } from "./types";

// Above the Spotlight sheet (13100) and every Joy modal so the portaled
// menu is never buried under its own host surface.
const DROPDOWN_Z_INDEX = 14000;
const VIEWPORT_GUTTER = 8;
const MAX_MENU_HEIGHT = 280;

// The shared icon vocabulary (`MENTION_ICONS`), which is also what the
// answer's citation chips use (`_sourceIcon` in SpotlightOverlay /
// `sourceIcon` in SourceChips) — so a mention option, the editor row for
// the same thing, and the source chip it later becomes all read as one
// object. A milestone (a task flagged `isMilestone`) takes the flag icon
// so it reads as a milestone even though it resolves as a task on the
// wire. `user` is absent: people render their real profile photo (see
// `renderIdentity`), not an icon.
const kindIcon = (ref: Exclude<AgentMentionRef, { kind: "user" }>) => {
    switch (ref.kind) {
        case "task":
            return ref.isMilestone ? MENTION_ICONS.milestone : MENTION_ICONS.task;
        case "note":
            return MENTION_ICONS.note;
        case "chat":
            return MENTION_ICONS.chat;
        case "project":
            return MENTION_ICONS.project;
        case "group":
            return MENTION_ICONS.group;
        case "todo":
            return MENTION_ICONS.todo;
    }
};

// The per-type identity color (shared with the message-body `#`/`@`
// chips), painted as the disc background + icon. `user` is absent — a
// user row is a photo, not a colored disc (see `renderIdentity`).
const kindPalette = (ref: Exclude<AgentMentionRef, { kind: "user" }>): MentionPalette => {
    switch (ref.kind) {
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

// The leading identity visual for a row. A user shows their real profile
// photo (`avatarImgPath` → absolute src via the context-free
// `buildAvatarSrc`), falling back to the initial of their name the same
// way `UserAvatar` does — so a user with no photo still reads as a person
// disc, not a broken image. This is the one place the two menus can't
// share: the editor rows use `UserAvatar` (online dot, live name), which
// needs an AvatarContext this menu may not have. Sized 36 to match it.
//
// Every other kind shows its colored icon disc — circular for a group,
// rounded square for entities, the BlockNote menus' "some people" vs "a
// thing" cue.
const renderIdentity = (c: AgentMentionCandidate, isDark: boolean) => {
    if (c.ref.kind === "user") {
        return (
            <Avatar
                size="sm"
                src={buildAvatarSrc(c.avatarImgPath)}
                sx={{ width: 36, height: 36, fontSize: "0.9rem" }}
            >
                {(c.ref.label || "?").charAt(0).toUpperCase()}
            </Avatar>
        );
    }
    return (
        <MentionIconDisc
            icon={kindIcon(c.ref)}
            isDark={isDark}
            palette={kindPalette(c.ref)}
            shape={c.ref.kind === "group" ? "circle" : "rounded"}
        />
    );
};

// The right-aligned slot, matching the editor rows: a task's status chip,
// a group's member count, a person's custom status. Absent when the
// candidate carries no such detail.
const renderTrailing = (c: AgentMentionCandidate, isDark: boolean) => {
    if (c.ref.kind === "task") {
        // The canonical dashboard status chip, so a status reads
        // identically here, in the editor menu, and in the task surfaces.
        // No chip at all when the status is unknown, rather than a
        // misleading "Open".
        return c.status ? <TaskStatusChip iconSize={11} status={c.status} /> : undefined;
    }
    if (c.ref.kind === "group") {
        return c.memberCount == null ? undefined : <MentionCountChip count={c.memberCount} />;
    }
    if (c.ref.kind === "user" && c.customStatus) {
        return <MentionCustomStatus isDark={isDark} text={c.customStatus} />;
    }
    return undefined;
};

// The muted second line. Reuses the BlockNote menus' own wording
// (`common.editor.*`) so the two menus read identically.
// `useTranslation()` returns the English stub when no I18nProvider is
// mounted, so this is safe on every surface.
const kindSubtitle = (t: Messages, c: AgentMentionCandidate): string => {
    const e = t.common.editor;
    const { ref, subtitle } = c;
    switch (ref.kind) {
        case "user":
            // The editor's `@` row shows the person's email — the one
            // reliable way to tell two same-named teammates apart. Falls
            // back to the generic "Person" label when the source dataset
            // carried no email.
            return c.email || e.mentionPerson;
        case "group":
            // Editor parity: the group's own description, with the generic
            // "Mention group" label as the fallback.
            return c.description || e.mentionGroupLabel;
        case "task": {
            // Mirror the BlockNote row: "Task · <id> · <project>" when the
            // project is known (across projects it's the only thing
            // separating two same-named tasks), else "Task · <id>" /
            // "Milestone · <id>". The id falls back to the raw task id when
            // there's no display id, the same rule the editor uses.
            const id = subtitle || String(ref.taskId);
            if (c.projectName) {
                return fmt(ref.isMilestone ? e.hashMilestoneProject : e.hashTaskProject, {
                    id,
                    project: c.projectName,
                });
            }
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
                return (
                    <Box
                        key={c.key}
                        aria-selected={highlighted}
                        data-testid={`agent-mention-option-${c.key}`}
                        role="option"
                        sx={{
                            display: "flex",
                            alignItems: "center",
                            minWidth: 0,
                            mx: 0.5,
                            px: 1,
                            py: 0.25,
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
                        <MentionMenuRow
                            identity={renderIdentity(c, isDark)}
                            isDark={isDark}
                            label={c.ref.label}
                            subtitle={kindSubtitle(t, c)}
                            trailing={renderTrailing(c, isDark)}
                            trigger={c.trigger}
                            variant={c.ref.kind === "user" ? "person" : "entity"}
                            badge={
                                c.isSelf ? (
                                    <MentionSelfChip label={t.common.editor.mentionYou} />
                                ) : undefined
                            }
                        />
                    </Box>
                );
            })}
        </Sheet>,
        document.body
    );
};
