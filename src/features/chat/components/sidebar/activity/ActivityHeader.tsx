import React from "react";
import { Box, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../types/chat";
import { extractYYYYMMDDHHMM } from "../../../../../utils/dateUtils";
import { ActivityAvatar } from "./ActivityAvatar";
import { ActivityTypeChips } from "./ActivityTypeChips";

interface ActivityHeaderProps {
    useTEM: TeamManagementState;
    activity: ActivityMessageProps;
    myself: UserProps;
    socket: Socket | null;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    isYou: boolean;
    chatTypeLookup: { [key: number]: string };
    useCM: ChatManagementState;
}

export const ActivityHeader: React.FC<ActivityHeaderProps> = ({
    useTEM,
    activity,
    myself,
    socket,
    setMyself,
    useUISM,
    isYou,
    chatTypeLookup,
    useCM,
}) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    return (
        <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
            spacing={1.5}
            sx={{ minHeight: 32 }}
        >
            <Stack
                direction="row"
                spacing={1.25}
                alignItems="center"
                sx={{ minWidth: 0, flex: 1 }}
            >
                <Box
                    sx={{
                        position: "relative",
                        flexShrink: 0,
                    }}
                >
                    <ActivityAvatar
                        activity={activity}
                        useCM={useCM}
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                </Box>

                {/* Name for DM and GM only */}
                {activity.chatType !== 3 && activity.chatType !== 4 && (
                    <Typography
                        level="title-sm"
                        noWrap
                        sx={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                            letterSpacing: "-0.01em",
                            minWidth: 0,
                        }}
                    >
                        {isYou ? `${activity.chatName} (you)` : activity.chatName}
                    </Typography>
                )}

                <ActivityTypeChips activity={activity} chatTypeLookup={chatTypeLookup} />
            </Stack>

            {/* Right-aligned timestamp and unread indicator */}
            <Stack alignItems="center" direction="row" spacing={1} sx={{ flexShrink: 0, ml: 1 }}>
                <Typography
                    level="body-xs"
                    noWrap
                    sx={{
                        display: { xs: "none", md: "block" },
                        fontSize: "0.7rem",
                        fontWeight: 500,
                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                        letterSpacing: "0.02em",
                    }}
                >
                    {extractYYYYMMDDHHMM(activity.tsSent)}
                </Typography>

                {/* Unread dot indicator */}
                {activity.isRead === false && (
                    <Box
                        sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            background: isDark
                                ? "linear-gradient(135deg, #a78bfa 0%, #818cf8 100%)"
                                : "linear-gradient(135deg, #7c3aed 0%, #6366f1 100%)",
                            boxShadow: isDark
                                ? "0 0 8px rgba(167,139,250,0.5)"
                                : "0 0 8px rgba(124,58,237,0.4)",
                            flexShrink: 0,
                        }}
                    />
                )}
            </Stack>
        </Stack>
    );
};
