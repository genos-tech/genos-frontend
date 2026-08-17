// The ONE row layout for every `@`/`#` suggestion menu in the app.
//
// There are two hosts and they cannot share a menu component:
//
//   • the BlockNote editors (`Mention.tsx`, `HashMention.tsx`), whose rows
//     go into BlockNote's own `SuggestionMenuController`, and
//   • `MentionSuggestionDropdown`, the portaled menu for plain Joy inputs
//     (Spotlight, ThreadAsk, NoteAsk, to-do titles).
//
// They differ in what they can render, not in how a row should LOOK — the
// dropdown reaches surfaces mounted outside AvatarContext (Spotlight), so
// it can't use `UserAvatar` and passes a bare `<Avatar>` instead. That is
// why the identity visual is a slot: the two hosts fill it differently and
// agree on everything else.
//
// Before this module the two grew apart — a task was an assignment
// clipboard in one menu and a check-circle in the other, a group row had a
// member count in one and not the other. The row body and the icon
// vocabulary (`MENTION_ICONS`) live here so that can't happen again: the
// BlockNote menus are the reference look, and this is that look, factored
// out rather than reimplemented.
//
// BUNDLE RULE, same as `mentionPalettes`: this module must NEVER import
// `@blocknote/*` (nor anything that does). It sits in the dropdown's
// import graph, and the dropdown is in Spotlight's entry chunk — one
// BlockNote import here drags the whole editor runtime into it.

import type { ElementType, ReactNode } from "react";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";
import { Box, Chip, Typography } from "@mui/joy";

import { mentionIconColor, type MentionPalette } from "./mentionPalettes";

/**
 * Which icon means which kind of thing — shared so a `#task` is the same
 * glyph in the editor menu, the dropdown, and (via the citation chips) a
 * Spotlight answer.
 *
 * `todo` reuses the task glyph deliberately: it has no BlockNote `#`
 * equivalent to match, and it is already the icon Spotlight's todo
 * citation chip uses, so following that beats inventing a third glyph.
 * Its violet palette and "To-do" subtitle are what separate it from a
 * task row.
 */
export const MENTION_ICONS = {
    task: TaskAltRoundedIcon,
    milestone: FlagRoundedIcon,
    note: StickyNote2RoundedIcon,
    chat: ForumRoundedIcon,
    project: FolderRoundedIcon,
    group: GroupRoundedIcon,
    todo: TaskAltRoundedIcon,
} as const satisfies Record<string, ElementType>;

/**
 * The leading 32px identity visual for a non-person row: the kind's icon
 * on a wash of its own palette.
 *
 * A group takes the `circle` shape and entities the `rounded` square —
 * the BlockNote menus' who/what cue, which survives here because it is
 * the fastest way to tell "some people" from "a thing".
 */
export const MentionIconDisc = ({
    icon: Icon,
    palette,
    shape = "rounded",
    isDark,
}: {
    icon: ElementType;
    palette: MentionPalette;
    shape?: "circle" | "rounded";
    isDark?: boolean;
}) => (
    <Box
        sx={{
            width: 32,
            height: 32,
            flexShrink: 0,
            borderRadius: shape === "circle" ? "50%" : "8px",
            background: palette.bg,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
        }}
    >
        <Icon sx={{ fontSize: 18, color: mentionIconColor(palette, isDark) }} />
    </Box>
);

/** The "YOU" badge on your own `@` row, so you don't mention yourself by
 *  accident when two teammates share a first name. */
export const MentionSelfChip = ({ label }: { label: string }) => (
    <Chip
        color="warning"
        size="sm"
        variant="soft"
        sx={{
            fontSize: "0.6rem",
            fontWeight: 700,
            textTransform: "uppercase",
            letterSpacing: "0.04em",
            minHeight: 0,
            py: "1px",
            px: "5px",
            "--Chip-paddingInline": "5px",
            flexShrink: 0,
        }}
    >
        {label}
    </Chip>
);

/** A group row's member count — how many people the mention will reach. */
export const MentionCountChip = ({ count }: { count: number }) => (
    <Chip color="success" size="sm" sx={{ ml: "auto", flexShrink: 0 }} variant="soft">
        {count}
    </Chip>
);

/** A person's custom status, pulled right so it never crowds their name.
 *  Italic + muted so it reads as ambient context, not a primary label. */
export const MentionCustomStatus = ({ text, isDark }: { text: string; isDark?: boolean }) => (
    <Typography
        level="body-xs"
        sx={{
            opacity: isDark ? 1 : 0.7,
            color: isDark ? "rgba(255,255,255,0.62)" : undefined,
            fontStyle: "italic",
            ml: "auto",
            flexShrink: 0,
            maxWidth: 140,
            whiteSpace: "nowrap",
            overflow: "hidden",
            textOverflow: "ellipsis",
        }}
    >
        {text}
    </Typography>
);

/**
 * `person` rows are taller: a 36px avatar needs the breathing room, and
 * their two lines (name over email) sit slightly apart. `entity` rows are
 * denser because a `#` menu is usually a longer list.
 */
export type MentionRowVariant = "person" | "entity";

const VARIANT_METRICS: Record<MentionRowVariant, { gap: number; py: number; textGap: number }> = {
    person: { gap: 1.25, py: 0.25, textGap: 0.125 },
    entity: { gap: 1, py: 0, textGap: 0 },
};

export interface MentionMenuRowProps {
    /** Avatar or `MentionIconDisc` — the host supplies it (see the module
     *  comment: only one of the two hosts can render a `UserAvatar`). */
    identity: ReactNode;
    /** `"@"` or `"#"`, rendered immediately before `label`. Kept separate
     *  so callers can't forget it, or double it up. */
    trigger: string;
    /** The bold first line: a person's name, a task's title, … */
    label: string;
    /** Muted second line — the kind, an id, a project, an email. */
    subtitle?: ReactNode;
    /** Sits inline right after `label` (the "YOU" chip). */
    badge?: ReactNode;
    /**
     * Right-aligned slot: a task's status chip, a group's member count, a
     * person's custom status. OUTSIDE the text column, so a long label
     * ellipsizes against the space that's left instead of shoving it out.
     */
    trailing?: ReactNode;
    variant?: MentionRowVariant;
    /** Spotlight's translucent sheet, where Joy's default text tokens are
     *  illegible; switches to explicit muted whites. */
    isDark?: boolean;
}

export const MentionMenuRow = ({
    identity,
    trigger,
    label,
    subtitle,
    badge,
    trailing,
    variant = "entity",
    isDark,
}: MentionMenuRowProps) => {
    const metrics = VARIANT_METRICS[variant];
    const name = (
        <Typography
            level="body-sm"
            sx={{
                fontWeight: 600,
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                minWidth: 0,
                color: isDark ? "rgba(255,255,255,0.92)" : undefined,
            }}
        >
            {trigger}
            {label}
        </Typography>
    );

    return (
        <Box
            alignItems="center"
            display="flex"
            gap={metrics.gap}
            sx={{ minWidth: 0, width: "100%", py: metrics.py }}
        >
            <Box sx={{ display: "flex", flexShrink: 0 }}>{identity}</Box>
            <Box
                sx={{
                    display: "flex",
                    flexDirection: "column",
                    minWidth: 0,
                    flex: 1,
                    gap: metrics.textGap,
                }}
            >
                {badge ? (
                    <Box alignItems="center" display="flex" gap={0.5} sx={{ minWidth: 0 }}>
                        {name}
                        {badge}
                    </Box>
                ) : (
                    name
                )}
                {subtitle ? (
                    <Typography
                        level="body-xs"
                        sx={{
                            whiteSpace: "nowrap",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            // Dark mode needs an explicit muted white:
                            // stacking opacity on Joy's light-ground token
                            // washes the line out entirely.
                            color: isDark ? "rgba(255,255,255,0.62)" : undefined,
                            opacity: isDark ? 1 : 0.7,
                        }}
                    >
                        {subtitle}
                    </Typography>
                ) : null}
            </Box>
            {trailing}
        </Box>
    );
};
