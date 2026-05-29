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

    // For DMs the activity payload's `chatName` is sender-centric — the
    // sender's frontend passes its own view of the DM title (the partner
    // user's name) as `destCGName`, which is the OTHER user from the
    // receiver's POV. Prefer the server-resolved per-user `chatName`
    // from `useCM.allChats` when available. Other chat types carry a
    // viewer-independent title (group / project / task / note name) so
    // the activity payload value is fine for them.
    // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is `string`
    // post-flip; `ActivityMessageProps.chatId` is still `number`.
    // Stringify at the comparison.
    const resolvedChatName =
        activity.chatType === 1
            ? (useCM.allChats.find(
                  (chat) => chat.chatType === 1 && chat.chatId === String(activity.chatId)
              )?.chatName ?? activity.chatName)
            : activity.chatName;

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

                {/* Surface title. For DM / GM we render the chat name +
                    "(you)" suffix on DMs to your own user. For task-body
                    and note mentions (chat_type 5-8) `chatName` is the
                    task title / note title — render it the same way so
                    the user can scan "Mentioned in: <title>" at a glance.
                    PM (3) and chat_type=4 surfaces self-label via the
                    chips and have no separate human name to show. */}
                {(activity.chatType === 1 ||
                    activity.chatType === 2 ||
                    activity.chatType >= 5) && (
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
                        {activity.chatType === 1 && isYou
                            ? `${resolvedChatName} (you)`
                            : resolvedChatName}
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
                                ? "linear-gradient(135deg, #a78bfa 0%, #c084fc 100%)"
                                : "linear-gradient(135deg, #7c3aed 0%, #6d28d9 100%)",
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
