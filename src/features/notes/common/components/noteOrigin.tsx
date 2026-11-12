import type { ComponentProps } from "react";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";
import QuestionAnswerRoundedIcon from "@mui/icons-material/QuestionAnswerRounded";
import ShareRoundedIcon from "@mui/icons-material/ShareRounded";

/**
 * Where a note came from, as one icon (MIP-1429).
 *
 * One icon per family, used wherever a note is listed (the section header, a Recents row, a
 * Favorites group, a tab, History), so the same glyph always means the same place:
 *
 *   1 My Notes       a person
 *   4 Shared notes   the share arrow
 *   8 Team Notes     people
 *   2 Task notes     the clipboard the Tasks rail icon uses
 *   3 Chat notes     the speech bubbles the Chats rail icon uses
 *
 * My Notes used to be a 2x2 grid, which meant nothing, and was the icon of "a personal note"
 * in Recents. The keys are the sidebar's note-type buckets (see `noteTypeAlias`).
 */
const ORIGIN_ICON = {
    1: PersonRoundedIcon,
    4: ShareRoundedIcon,
    8: GroupsRoundedIcon,
    2: AssignmentRoundedIcon,
    3: QuestionAnswerRoundedIcon,
} as const;

type OriginIconProps = { noteType: number; sx?: ComponentProps<typeof PersonRoundedIcon>["sx"] };

export const NoteOriginIcon = ({ noteType, sx }: OriginIconProps) => {
    const Icon = ORIGIN_ICON[noteType as keyof typeof ORIGIN_ICON];
    return Icon ? <Icon sx={sx} /> : null;
};
