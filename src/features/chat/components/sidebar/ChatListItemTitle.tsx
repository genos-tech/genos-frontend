import React from "react";
import LockOutlineRoundedIcon from "@mui/icons-material/LockOutlineRounded";
import { Box, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { resolveDisplayName } from "../../../../components/ui/avatars/AvatarContext";
import { ExternalChip } from "../../../../components/ui/misc/ExternalChip";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { fmt, useTranslation } from "../../../../i18n";
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
    const { mode } = useColorScheme();
    const { t } = useTranslation();
    const isDark = mode === "dark";

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
                {/* Name row with lock icon and group indicator */}
                <Stack alignItems="center" direction="row" spacing={0.5} sx={{ minWidth: 0 }}>
                    {chat.isPrivate && (
                        <LockOutlineRoundedIcon
                            sx={{
                                fontSize: 13,
                                color: isDark ? "rgba(255,255,255,0.4)" : "rgba(0,0,0,0.35)",
                                flexShrink: 0,
                            }}
                        />
                    )}
                    <Typography
                        level="title-sm"
                        sx={{
                            fontWeight: 600,
                            fontSize: "1rem",
                            color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                            minWidth: 0,
                            lineHeight: 1.3,
                        }}
                        noWrap
                    >
                        {isYou ? `${displayName} (you)` : displayName}
                    </Typography>
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
                    <Typography
                        level="body-xs"
                        sx={{
                            fontSize: "0.7rem",
                            fontWeight: 500,
                            color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                            lineHeight: 1.2,
                            pl: chat.isPrivate ? 2.25 : 0, // Align with name when lock icon present
                            fontStyle: "italic",
                            letterSpacing: "0.01em",
                        }}
                        noWrap
                    >
                        {customStatus}
                    </Typography>
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
