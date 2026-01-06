import React from "react";
import LockOutlineRoundedIcon from "@mui/icons-material/LockOutlineRounded";
import { Box, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";

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

    return (
        <Box sx={{ minWidth: 0 }}>
            <Stack direction="row" spacing={0.75} alignItems="center" sx={{ minWidth: 0 }}>
                {chat.isPrivate && (
                    <LockOutlineRoundedIcon
                        sx={{
                            fontSize: 14,
                            color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.4)",
                            flexShrink: 0,
                        }}
                    />
                )}
                <Typography
                    level="title-sm"
                    noWrap
                    sx={{
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                        minWidth: 0,
                    }}
                >
                    {isYou ? `${chat.chatName} (you)` : chat.chatName}
                </Typography>

                {customStatus && (
                    <Chip
                        size="sm"
                        variant="soft"
                        sx={{
                            height: 18,
                            fontSize: "0.65rem",
                            fontWeight: 500,
                            borderRadius: "6px",
                            px: 0.75,
                            background: isDark ? "rgba(255,255,255,0.06)" : "rgba(0,0,0,0.04)",
                            color: isDark ? "rgba(255,255,255,0.6)" : "rgba(0,0,0,0.55)",
                            flexShrink: 0,
                        }}
                    >
                        {customStatus}
                    </Chip>
                )}
            </Stack>
        </Box>
    );
};
