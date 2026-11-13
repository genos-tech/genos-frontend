// The icon of a "Messages sent" line in a Genos report card (MIP-1333): the chat's own avatar,
// as the chat list draws it, or the generic emoji when the chat is not in the member's list.
//
// Decorative: the chat's name is in the line's text, so the whole slot is `aria-hidden` and a
// screen reader reads the row exactly as it did with the emoji. The slot is one text line high
// (the `body-sm` line) and one `xs` avatar wide, so a row does not change height or shift its
// text; an avatar is drawn from what the chat list already holds, and nothing is requested here.

import { memo, type ReactNode } from "react";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import { Box } from "@mui/joy";

import { useOptionalAvatarContext } from "../../../components/ui/avatars/AvatarContext";
import { BaseAvatar } from "../../../components/ui/avatars/BaseAvatar";
import { GroupChatAvatar, ProjectChatAvatar } from "../../../components/ui/avatars/ChatKindAvatar";
import { UserAvatar } from "../../../components/ui/avatars/UserAvatar";
import { TYPE_SCALE } from "../../../theme/tokens";
import { AVATAR } from "../../../theme/tokens/scales";
import { withAvatarVersion } from "../../../utils/avatarSrc";
import { useGMProfileImageVersion } from "../../../utils/gmProfileImageVersion";
import type { ReportChatMark } from "../utils/reportChatMarks";

/** Width of the icon slot: the `xs` avatar, as wide as the emoji slot it replaces. */
const CHAT_ICON_SLOT = AVATAR.xs;

const ChatIconSlot = ({ children }: { children: ReactNode }) => (
    <Box
        aria-hidden="true"
        component="div"
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
    ({ mark, fallback }: { mark: ReportChatMark; fallback: string }) => {
        const avatarContext = useOptionalAvatarContext();
        if (mark.kind === "dm" && !avatarContext) {
            return (
                <ChatIconSlot>
                    <Box component="span" sx={{ fontSize: 14, lineHeight: 1 }}>
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
                avatar = (
                    <BaseAvatar size="xs">
                        <PeopleRoundedIcon />
                    </BaseAvatar>
                );
        }
        return <ChatIconSlot>{avatar}</ChatIconSlot>;
    }
);
ReportChatIcon.displayName = "ReportChatIcon";
