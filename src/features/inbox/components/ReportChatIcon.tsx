// The icon of a "Messages sent" line in a Genos report card (MIP-1333): the chat's own avatar,
// as the chat list draws it, or the generic emoji when the chat is not in the member's list.
//
// Decorative: the chat's name is in the line's text, so the whole slot is `aria-hidden` and a
// screen reader reads the row exactly as it did with the emoji. The slot is one text line high
// (the `body-sm` line) and one `xs` avatar wide, so a row does not change height or shift its
// text; an avatar is drawn from what the chat list already holds, and nothing is requested here.

import { memo, type ReactNode } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import GroupsIcon from "@mui/icons-material/Groups";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import { Box } from "@mui/joy";

import { useOptionalAvatarContext } from "../../../components/ui/avatars/AvatarContext";
import { BaseAvatar } from "../../../components/ui/avatars/BaseAvatar";
import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import { TYPE_SCALE } from "../../../theme/tokens";
import { AVATAR } from "../../../theme/tokens/scales";
import type { ReportChatMark } from "../utils/reportChatMarks";

/** Width of the icon slot: the `xs` avatar, as wide as the emoji slot it replaces. */
export const CHAT_ICON_SLOT = AVATAR.xs;

export const ChatIconSlot = ({ children }: { children: ReactNode }) => (
    <Box
        aria-hidden="true"
        component="span"
        data-report-chat-icon=""
        sx={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
            width: CHAT_ICON_SLOT,
            // One line of the text beside it, so the avatar is centred on the first line.
            height: TYPE_SCALE["body-sm"].line,
        }}
    >
        {children}
    </Box>
);

/** The avatar for a mark, or null when it cannot be drawn here (a DM outside the avatar
 *  context, as in an isolated render): the caller then keeps the emoji. */
export const ReportChatIcon = memo(({ mark }: { mark: ReportChatMark }) => {
    const avatarContext = useOptionalAvatarContext();
    if (mark.kind === "dm" && !avatarContext) return null;
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
            avatar = (
                <BaseAvatar size="xs" src={mark.src}>
                    <GroupsIcon />
                </BaseAvatar>
            );
            break;
        case "pm":
            avatar = (
                <BaseAvatar size="xs" src={mark.src}>
                    <AssignmentIcon />
                </BaseAvatar>
            );
            break;
        default:
            avatar = (
                <BaseAvatar size="xs">
                    <PeopleRoundedIcon />
                </BaseAvatar>
            );
    }
    return <ChatIconSlot>{avatar}</ChatIconSlot>;
});
ReportChatIcon.displayName = "ReportChatIcon";
