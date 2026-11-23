// BundleRule: like `mentionMenuRow`, this must never import `@blocknote/*`.
import type { ElementType } from "react";
import AutoStoriesRoundedIcon from "@mui/icons-material/AutoStoriesRounded";
import EventRoundedIcon from "@mui/icons-material/EventRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import FolderRoundedIcon from "@mui/icons-material/FolderRounded";
import ForumRoundedIcon from "@mui/icons-material/ForumRounded";
import GroupRoundedIcon from "@mui/icons-material/GroupRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
import TaskAltRoundedIcon from "@mui/icons-material/TaskAltRounded";

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
    // An agent mention made by "Ask Genos about this event"; never a row of the `#` menu.
    calendarEvent: EventRoundedIcon,
    // A Genos skill in the `/` menu of Spotlight and the Genos page (MIP-2042), the glyph of the Skills page.
    skill: AutoStoriesRoundedIcon,
} as const satisfies Record<string, ElementType>;
