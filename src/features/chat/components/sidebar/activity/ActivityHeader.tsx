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

    // The activity payload's `chatName` is frozen when the row is adapted
    // (`v3ActivityToLegacy`): for DMs it's sender-centric, and for ANY
    // channel-backed surface it falls back to a bare "?" placeholder when
    // the source channel wasn't in the local snapshot at adapt time —
    // which is the common case in the activity feed (rows arrive before /
    // independently of the channel list). Resolve the viewer-correct
    // title from the live chat list for channel-backed types (1-4), keyed
    // by the unique channel id. Surface mentions (5-8) carry their task /
    // project / note title in the payload, so those stay as-is. Finally,
    // never surface the raw "?" — blank reads far cleaner on the row.
    // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is `string`
    // post-flip; `ActivityMessageProps.chatId` is still `number`.
    // Stringify at the comparison.
    const resolvedFromChatList =
        activity.chatType <= 4
            ? useCM.allChats.find((chat) => chat.chatId === String(activity.chatId))?.chatName
            : undefined;
    const rawChatName = resolvedFromChatList || activity.chatName;
    const resolvedChatName = rawChatName === "?" ? "" : rawChatName;

    return (
        <Stack
            alignItems="center"
            direction="row"
            justifyContent="space-between"
            spacing={1.5}
            sx={{ minHeight: 32 }}
        >
            <Stack
                alignItems="center"
                direction="row"
                spacing={1.25}
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
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
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
                        sx={{
                            fontWeight: 600,
                            fontSize: "0.875rem",
                            color: isDark ? "rgba(255,255,255,0.9)" : "rgba(0,0,0,0.85)",
                            letterSpacing: "-0.01em",
                            minWidth: 0,
                        }}
                        noWrap
                    >
                        {activity.chatType === 1 && isYou
                            ? `${resolvedChatName} (you)`
                            : resolvedChatName}
                    </Typography>
                )}

                <ActivityTypeChips
                    activity={activity}
                    chatTypeLookup={chatTypeLookup}
                    resolvedChatName={resolvedChatName}
                />
            </Stack>

            {/* Right-aligned timestamp and unread indicator */}
            <Stack alignItems="center" direction="row" spacing={1} sx={{ flexShrink: 0, ml: 1 }}>
                <Typography
                    level="body-xs"
                    sx={{
                        display: { xs: "none", md: "block" },
                        fontSize: "0.7rem",
                        fontWeight: 500,
                        color: isDark ? "rgba(255,255,255,0.45)" : "rgba(0,0,0,0.45)",
                        letterSpacing: "0.02em",
                    }}
                    noWrap
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
                                ? "linear-gradient(135deg, var(--gp-brandalt-400) 0%, var(--gp-brand-400) 100%)"
                                : "linear-gradient(135deg, var(--gp-brand-700) 0%, var(--gp-brand-800) 100%)",
                            boxShadow: isDark
                                ? "0 0 8px rgba(var(--gp-brandalt-400-rgb), 0.5)"
                                : "0 0 8px rgba(var(--gp-brand-700-rgb), 0.4)",
                            flexShrink: 0,
                        }}
                    />
                )}
            </Stack>
        </Stack>
    );
};
