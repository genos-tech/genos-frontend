import AccountTreeRoundedIcon from "@mui/icons-material/AccountTreeRounded";
import FlagRoundedIcon from "@mui/icons-material/FlagRounded";
import GroupsRoundedIcon from "@mui/icons-material/GroupsRounded";
import NotificationsActiveRoundedIcon from "@mui/icons-material/NotificationsActiveRounded";
import PersonRoundedIcon from "@mui/icons-material/PersonRounded";

// Chat type constants
export const CHAT_PANE_TYPES = {
    DM: 1,
    GM: 2,
    PM: 3,
    MDM: 4,
    ACTIVITY: 5,
    FLAGGED: 6,
} as const;

// Navigation item configuration
// Note: MDM (Multi-user DM) is now integrated into DM section, not shown as separate nav item
// Exported so the chat list keyboard-shortcut handler in `ChatList.tsx`
// shares the same tab order — keep them in sync.
//
// `colorScheme` carries BOTH the plain `var(--gp-…)` reference (for
// opaque fills) and its `-rgb` companion triplet. The alpha variants
// below MUST compose through `rgba(var(--…-rgb), α)`: the old
// `${colorScheme.dark}cc` hex-alpha concatenation yields the literal
// string `var(--gp-brandalt-400)cc`, which is not a color — it
// invalidated the whole `linear-gradient()` and dropped the unread
// badge's background entirely, leaving white-on-white (the "the unread
// chip disappeared" bug). See the note at the top of `purplePalette.ts`.
export const NAV_ITEMS = [
    {
        type: CHAT_PANE_TYPES.DM,
        icon: PersonRoundedIcon,
        labelKey: "navDM" as const,
        shortLabelKey: "navDMShort" as const,
        colorScheme: {
            dark: "var(--gp-brandalt-400)",
            light: "var(--gp-brand-700)",
            darkRgb: "var(--gp-brandalt-400-rgb)",
            lightRgb: "var(--gp-brand-700-rgb)",
        },
    },
    {
        type: CHAT_PANE_TYPES.GM,
        icon: GroupsRoundedIcon,
        labelKey: "navGM" as const,
        shortLabelKey: "navGMShort" as const,
        colorScheme: {
            dark: "var(--gp-brandalt-400)",
            light: "var(--gp-brand-700)",
            darkRgb: "var(--gp-brandalt-400-rgb)",
            lightRgb: "var(--gp-brand-700-rgb)",
        },
    },
    {
        type: CHAT_PANE_TYPES.PM,
        icon: AccountTreeRoundedIcon,
        labelKey: "navPM" as const,
        shortLabelKey: "navPMShort" as const,
        colorScheme: {
            dark: "var(--gp-brandalt-400)",
            light: "var(--gp-brand-700)",
            darkRgb: "var(--gp-brandalt-400-rgb)",
            lightRgb: "var(--gp-brand-700-rgb)",
        },
    },
    {
        type: CHAT_PANE_TYPES.FLAGGED,
        icon: FlagRoundedIcon,
        labelKey: "navFlagged" as const,
        shortLabelKey: "navFlaggedShort" as const,
        colorScheme: {
            dark: "var(--gp-brandalt-400)",
            light: "var(--gp-brand-700)",
            darkRgb: "var(--gp-brandalt-400-rgb)",
            lightRgb: "var(--gp-brand-700-rgb)",
        },
    },
    {
        type: CHAT_PANE_TYPES.ACTIVITY,
        icon: NotificationsActiveRoundedIcon,
        labelKey: "navActivity" as const,
        shortLabelKey: "navActivityShort" as const,
        colorScheme: {
            dark: "var(--gp-brandalt-400)",
            light: "var(--gp-brand-700)",
            darkRgb: "var(--gp-brandalt-400-rgb)",
            lightRgb: "var(--gp-brand-700-rgb)",
        },
    },
];
