import { mdmStackWidth } from "../../../components/ui/avatars/mdmStack";
import { AVATAR } from "../../../theme/tokens/scales";
import type { ReportChatMark } from "../utils/reportChatMarks";

/** Width of the icon slot of a line: the `xs` avatar, as wide as the emoji slot it replaces. */
export const CHAT_ICON_SLOT = AVATAR.xs;

/** The slot width a run of chat lines shares, so their text starts at one edge. A multi-person
 *  DM's stack of faces is wider than one avatar (three `xs` faces are 42px), and a line whose
 *  icon is wider would start its text later than the lines around it; so every line of the run
 *  takes the width of its widest stack. Without a stack it is the one-avatar width, as before.
 *  `marks` holds the mark of each chat line (none for a line with the emoji). */
export const reportChatSlotWidth = (marks: Iterable<ReportChatMark | undefined>): number => {
    let width: number = CHAT_ICON_SLOT;
    for (const mark of marks) {
        if (mark?.kind === "mdm")
            width = Math.max(width, mdmStackWidth(mark.members.length, CHAT_ICON_SLOT));
    }
    return width;
};
