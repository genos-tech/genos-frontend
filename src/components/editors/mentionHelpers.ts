import { compareText } from "../../i18n/collate";
import type { MentionPalette } from "./mentionPalettes";

// Shared visual treatment for every mention chip (user OR group). The
// only difference between variants is the colour palette; the pill
// shape, padding, hover transition, and typography stay identical so
// the two kinds of mention read as siblings instead of unrelated
// styles. To change the look of a mention, change `mentionChipSx`
// here and both chips update together.
export const mentionChipSx = (palette: MentionPalette) =>
    ({
        display: "inline-flex",
        alignItems: "center",
        gap: 0.5,
        backgroundColor: palette.bg,
        borderRadius: "12px",
        px: 1,
        py: 0.5,
        cursor: "pointer",
        userSelect: "none",
        fontSize: "0.875rem",
        transition: "background-color 0.15s ease",
        "&:hover": { backgroundColor: palette.bgHover },
    }) as const;

// Sort rule shared with the assignee/reporter picker (`ACTeamUsers`)
// so the same ordering shows up on every member-selection surface:
// self first (you almost always mean to mention/assign yourself when
// reaching for the picker), then everyone else by display name,
// case-insensitive. Pure — caller passes a fresh array, we never
// mutate the input.
export const sortMembersMyselfFirst = <T extends { userId: string; userName: string }>(
    members: T[],
    myselfUserId: string
): T[] => {
    return [...members].sort((a, b) => {
        if (a.userId === myselfUserId) return -1;
        if (b.userId === myselfUserId) return 1;
        return compareText(a.userName || "", b.userName || "", { sensitivity: "base" });
    });
};
