import React from "react";
import LockOutlineRoundedIcon from "@mui/icons-material/LockOutlineRounded";
import { Box, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

import { resolveDisplayName } from "../../../../components/ui/avatars/AvatarContext";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";

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
            </Stack>
        </Box>
    );
};
