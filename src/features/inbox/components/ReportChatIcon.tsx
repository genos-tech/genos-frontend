// The icon of a "Messages sent" line in a Genos report card (MIP-1333): the chat's own avatar,
// as the chat list draws it, or the generic emoji when the chat is not in the member's list.
//
// Decorative: the chat's name is in the line's text, so the whole slot is `aria-hidden` and a
// screen reader reads the row exactly as it did with the emoji. The slot is one text line high
// (the `body-sm` line) and one `xs` avatar wide, so a row does not change height or shift its
// text; an avatar is drawn from what the chat list already holds, and nothing is requested here.

import { memo, type ReactNode } from "react";
import { Box } from "@mui/joy";

import { useOptionalAvatarContext } from "../../../components/ui/avatars/AvatarContext";
import { BaseAvatar } from "../../../components/ui/avatars/BaseAvatar";
import { GroupChatAvatar, ProjectChatAvatar } from "../../../components/ui/avatars/ChatKindAvatar";
import { MDMAvatar } from "../../../components/ui/avatars/MDMAvatar";
import { mdmStackWidth } from "../../../components/ui/avatars/mdmStack";
import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import { TYPE_SCALE } from "../../../theme/tokens";
import { AVATAR } from "../../../theme/tokens/scales";
import { withAvatarVersion } from "../../../utils/avatarSrc";
import { useGMProfileImageVersion } from "../../../utils/gmProfileImageVersion";
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

const ChatIconSlot = ({ children, width }: { children: ReactNode; width: number }) => (
    <Box
        aria-hidden="true"
        component="div"
        data-report-chat-icon=""
        sx={{
            display: "flex",
            alignItems: "center",
            // At the start of the slot: a lone avatar in a slot widened for a stack beside it
            // stays at the row's start edge (the same place in LTR and RTL).
            justifyContent: "flex-start",
            flexShrink: 0,
            width,
            // One line of the text beside it, so the avatar is centred on the first line.
            height: TYPE_SCALE["body-sm"].line,
        }}
    >
        {children}
    </Box>
);

/** A group chat's picture with its `?v=` cache buster (the same one `GMAvatar` adds), so a picture
 *  uploaded this session is not served stale from the browser cache here. */
const GroupMark = ({ mark }: { mark: Extract<ReportChatMark, { kind: "gm" }> }) => {
    // `useGMProfileImageVersion` is keyed by the chat's (legacy numeric) id; as in `GMAvatar`,
    // the string id is cast once at the boundary.
    const version = useGMProfileImageVersion(mark.chatType, mark.chatId as unknown as number);
    return <GroupChatAvatar size="xs" src={withAvatarVersion(mark.src, version)} />;
};

/** The avatar for a mark, in its slot. A DM outside the avatar context (an isolated render; the
 *  app always has one) cannot be drawn, so the slot holds `fallback`, the generic emoji. */
export const ReportChatIcon = memo(
    ({
        mark,
        fallback,
        slotWidth = CHAT_ICON_SLOT,
    }: {
        mark: ReportChatMark;
        fallback: string;
        /** The width the run of chat lines shares (`reportChatSlotWidth`). */
        slotWidth?: number;
    }) => {
        const avatarContext = useOptionalAvatarContext();
        if (mark.kind === "dm" && !avatarContext) {
            return (
                <ChatIconSlot width={slotWidth}>
                    <Box
                        component="span"
                        sx={{
                            width: CHAT_ICON_SLOT,
                            textAlign: "center",
                            fontSize: 14,
                            lineHeight: 1,
                        }}
                    >
                        {fallback}
                    </Box>
                </ChatIconSlot>
            );
        }
        let avatar: ReactNode;
        switch (mark.kind) {
            case "dm":
                // The other person's avatar, as the chat list's DM row: the roster decides the
                // picture, the name fills the gap while it loads. Inert (no profile modal, no
                // presence dot): it is a mark, not a control.
                avatar = (
                    <UserAvatar
                        clickable={false}
                        fallbackName={mark.name}
                        showPulseDot={false}
                        size="xs"
                        userId={mark.userId}
                    />
                );
                break;
            case "initial":
                avatar = <BaseAvatar name={mark.name} size="xs" />;
                break;
            case "gm":
                avatar = <GroupMark mark={mark} />;
                break;
            case "pm":
                avatar = <ProjectChatAvatar size="xs" src={mark.src} />;
                break;
            default:
                // The chat list's own stack of member faces (`MDMAvatar`, one logic for both),
                // at the `xs` step. No `teamMemberProfiles`: no presence dot or paused-moon on a
                // mark, as for a DM above. A chat whose members are not known draws its people glyph.
                avatar = <MDMAvatar avatarSize={CHAT_ICON_SLOT} members={mark.members} />;
        }
        return <ChatIconSlot width={slotWidth}>{avatar}</ChatIconSlot>;
    }
);
ReportChatIcon.displayName = "ReportChatIcon";
