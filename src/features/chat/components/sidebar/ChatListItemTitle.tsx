import React from "react";
import LockOutlineRoundedIcon from "@mui/icons-material/LockOutlineRounded";
import { Box, Stack } from "@mui/joy";

import { resolveDisplayName } from "../../../../components/ui/avatars/AvatarContext";
import { ExternalChip } from "../../../../components/ui/misc/ExternalChip";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { fmt, useTranslation } from "../../../../i18n";
import { g, type } from "../../../../theme/tokens";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";
import { ChatListItemTags } from "./ChatListItemTags";

interface ChatListItemTitleProps {
    chat: AllChatProps;
    isYou: boolean;
    myself: UserProps;
    useTEM: TeamManagementState;
}

export const ChatListItemTitle: React.FC<ChatListItemTitleProps> = ({
    useTEM,
    chat,
    isYou,
    myself,
}) => {
    const { t } = useTranslation();

    const showMyCustomStatus =
        chat.dmPartnerUser.userId !== "" &&
        myself.userId === chat.dmPartnerUser.userId &&
        myself.customStatus !== "";

    const showOthersCustomStatus =
        chat.dmPartnerUser.userId !== "" &&
        myself.userId !== chat.dmPartnerUser.userId &&
        useTEM.teamMemberProfiles[chat.dmPartnerUser.userId] &&
        useTEM.teamMemberProfiles[chat.dmPartnerUser.userId].customStatus !== "";

    const customStatus = showMyCustomStatus
        ? myself.customStatus
        : showOthersCustomStatus
          ? useTEM.teamMemberProfiles[chat.dmPartnerUser.userId].customStatus
          : null;

    // MDM (chatType 4) chats have no server-side `chatName`; their title is the
    // comma-separated member names — the same source the chat header and the
    // sidebar MDM avatar use. Without deriving it here the sidebar item renders
    // a blank name for MDM chats. Each member's name is resolved live so a
    // rename (including your own) shows here instead of the cached member name.
    const mdmName = chat.mdmMembers
        ?.map((m) => resolveDisplayName(m.userId, m.userName, myself, useTEM.teamMemberProfiles))
        .join(", ");
    // DM (chatType 1) titles are the partner's name — resolve it live too so a
    // partner's rename shows without waiting for the chat row to re-sync.
    const displayName =
        chat.chatType === 4
            ? mdmName || chat.chatName
            : chat.chatType === 1 && chat.dmPartnerUser?.userId
              ? resolveDisplayName(
                    chat.dmPartnerUser.userId,
                    chat.chatName,
                    myself,
                    useTEM.teamMemberProfiles
                )
              : chat.chatName;

    return (
        <Box sx={{ minWidth: 0 }}>
            <Stack direction="column" spacing={0.25} sx={{ minWidth: 0 }}>
                {/* Name row with lock icon and group indicator. The name takes
                    the row's own type and weight (NavItem), so it follows the
                    density row and the unread emphasis without restating them. */}
                <Stack alignItems="center" direction="row" spacing={0.5} sx={{ minWidth: 0 }}>
                    {chat.isPrivate && (
                        <LockOutlineRoundedIcon
                            sx={{
                                fontSize: 13,
                                color: g.text.tertiary,
                                flexShrink: 0,
                            }}
                        />
                    )}
                    <Box
                        component="span"
                        sx={{
                            minWidth: 0,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                        }}
                    >
                        {isYou ? `${displayName} (you)` : displayName}
                    </Box>
                    {/* Never a hover-only affordance: people outside the
                        company are in this room, and that has to be
                        visible at a glance before anything is typed.

                        On the guest side the chip names the owning team
                        instead of saying "External": the row sits among
                        your own chats, and "whose room is this" is the
                        question a bare badge leaves you asking — the host
                        can close it, and its rules are theirs. */}
                    {chat.isExternal && (
                        <ExternalChip
                            hint={
                                chat.hostTeamName
                                    ? fmt(t.chat.sidebar.sharedByTeamHint, {
                                          team: chat.hostTeamName,
                                      })
                                    : t.chat.sidebar.externalBadgeHint
                            }
                            label={chat.hostTeamName || t.chat.sidebar.externalBadge}
                        />
                    )}
                </Stack>

                {/* Custom status row - only shown when status exists */}
                {customStatus && (
                    <Box
                        sx={{
                            ...type("body-xs"),
                            color: g.text.tertiary,
                            fontStyle: "italic",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            pl: chat.isPrivate ? 2.25 : 0, // Align with name when lock icon present
                        }}
                    >
                        {customStatus}
                    </Box>
                )}

                {/* GM rows: the user's personal tags act as the chat's
                    "status" — same sub-name slot a DM uses for the
                    partner's custom status (renders null on other chat
                    types or when the chat carries no tags). */}
                <ChatListItemTags chat={chat} />
            </Stack>
        </Box>
    );
};
