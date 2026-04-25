import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { PulseDot } from "../../../../components/ui/misc/PulseDot";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";

// Theme-aware styling
const HEADER_STYLES = {
    dark: {
        avatarBg: "rgba(99,102,241,0.1)",
        avatarBorder: "rgba(99,102,241,0.2)",
        chipBg: "linear-gradient(135deg, rgba(99,102,241,0.12) 0%, rgba(139,92,246,0.12) 100%)",
        chipBorder: "rgba(99,102,241,0.25)",
        onlineColor: "#22c55e",
        offlineColor: "#6b7280",
        lockBg: "rgba(251,191,36,0.15)",
        lockBorder: "rgba(251,191,36,0.3)",
        lockColor: "#fbbf24",
        textColor: "#f1f5f9",
        subtitleColor: "#94a3b8",
    },
    light: {
        avatarBg: "rgba(99,102,241,0.06)",
        avatarBorder: "rgba(79,70,229,0.12)",
        chipBg: "linear-gradient(135deg, rgba(99,102,241,0.08) 0%, rgba(139,92,246,0.08) 100%)",
        chipBorder: "rgba(79,70,229,0.2)",
        onlineColor: "#16a34a",
        offlineColor: "#9ca3af",
        lockBg: "rgba(245,158,11,0.1)",
        lockBorder: "rgba(217,119,6,0.25)",
        lockColor: "#d97706",
        textColor: "#1e293b",
        subtitleColor: "#64748b",
    },
};

type HeaderUserNameProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    chat?: ChatProps;
    isYou: boolean;
    useCM: ChatManagementState;
};

export const HeaderUserName = (props: HeaderUserNameProps) => {
    const { useTEM, socket, myself, setMyself, useUISM, chat, isYou, useCM } = props;
    const { mode } = useColorScheme();
    const isDark = mode === "dark";
    const styles = isDark ? HEADER_STYLES.dark : HEADER_STYLES.light;

    const headerUser: UserProps | undefined = chat
        ? useTEM.teamMemberProfiles[chat.dmPartnerUser.userId]
        : undefined;
    let isOnline: boolean = headerUser
        ? myself.userId === headerUser.userId
            ? myself?.isOfflineForced !== "true"
                ? true
                : false
            : headerUser.isOnline === true && headerUser.isOfflineForced !== "true"
              ? true
              : false
        : false;

    if (isYou === true) {
        isOnline = myself.isOfflineForced !== "true" ? true : false;
    }

    return (
        <Stack direction="row" spacing={1.5} sx={{ alignItems: "center" }}>
            {/* Avatar with styled container */}
            <Box
                sx={{
                    p: 0.5,
                    borderRadius: "12px",
                    background: styles.avatarBg,
                    border: `1px solid ${styles.avatarBorder}`,
                    transition: "all 0.2s ease",
                    "&:hover": {
                        background: isDark ? "rgba(99,102,241,0.15)" : "rgba(99,102,241,0.1)",
                    },
                }}
            >
                {chat && chat.chatType === 1 ? (
                    <AvatarWithStatus
                        avatarSize={38}
                        avatarUser={headerUser}
                        chat={chat}
                        useCM={useCM}
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useUISM={useUISM}
                    />
                ) : chat && chat.chatType === 2 ? (
                    <GMAvatar
                        avatarSize={38}
                        useCM={useCM}
                        gmChat={chat}
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                ) : chat && chat.chatType === 3 ? (
                    <ProjectAvatar
                        avatarSize={38}
                        useCM={useCM}
                        myself={myself}
                        pmChat={chat}
                        setMyself={setMyself}
                        socket={socket}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                ) : chat && chat.chatType === 4 ? (
                    <MDMAvatar
                        members={
                            useCM.allChats.find(
                                (c) => c.chatId === chat.chatId && c.chatType === 4
                            )?.mdmMembers
                        }
                        size="md"
                    />
                ) : null}
            </Box>

            {/* Name and status */}
            <Stack spacing={0.25}>
                <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                    {/* Private lock icon */}
                    {chat && chat.isPrivate && (
                        <Box
                            sx={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: 22,
                                height: 22,
                                borderRadius: "6px",
                                background: styles.lockBg,
                                border: `1px solid ${styles.lockBorder}`,
                            }}
                        >
                            <LockOutlinedIcon sx={{ fontSize: 14, color: styles.lockColor }} />
                        </Box>
                    )}

                    {/* Chat name */}
                    {chat?.chatType === 4 ? (
                        <Tooltip
                            title={
                                useCM.allChats
                                    .find((c) => c.chatId === chat.chatId && c.chatType === 4)
                                    ?.mdmMembers?.map((m) => m.userName)
                                    .join(", ") || chat?.chatName
                            }
                            placement="bottom"
                            arrow
                        >
                            <Typography
                                level="title-md"
                                sx={{
                                    fontWeight: 700,
                                    color: styles.textColor,
                                    letterSpacing: "-0.01em",
                                    maxWidth: 300,
                                    cursor: "default",
                                }}
                                noWrap
                            >
                                {chat?.chatName}
                            </Typography>
                        </Tooltip>
                    ) : (
                        <Typography
                            level="title-md"
                            sx={{
                                fontWeight: 700,
                                color: styles.textColor,
                                letterSpacing: "-0.01em",
                            }}
                            noWrap
                        >
                            {isYou ? `${chat?.chatName} (you)` : chat?.chatName}
                        </Typography>
                    )}

                    {/* Online/Offline status chip */}
                    {chat && chat.chatType === 1 && (
                        <Chip
                            size="sm"
                            variant="soft"
                            sx={{
                                height: 24,
                                borderRadius: "8px",
                                background: styles.chipBg,
                                border: `1px solid ${styles.chipBorder}`,
                                fontWeight: 600,
                                fontSize: "11px",
                                px: 0.75,
                            }}
                            startDecorator={
                                <PulseDot
                                    color={isOnline ? styles.onlineColor : styles.offlineColor}
                                />
                            }
                        >
                            <Typography
                                level="body-xs"
                                sx={{
                                    fontWeight: 600,
                                    color: isOnline ? styles.onlineColor : styles.offlineColor,
                                }}
                            >
                                {isOnline ? "Online" : "Offline"}
                            </Typography>
                        </Chip>
                    )}
                </Stack>

                {/* Custom status */}
                {chat && chat.dmPartnerUser.userId !== "" && (
                    <>
                        {/* Own custom status */}
                        {myself.userId === chat.dmPartnerUser.userId &&
                            myself.customStatus !== "" && (
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: styles.subtitleColor,
                                        fontWeight: 500,
                                        fontStyle: "italic",
                                    }}
                                >
                                    {myself.customStatus}
                                </Typography>
                            )}

                        {/* Others custom status */}
                        {myself.userId !== chat.dmPartnerUser.userId &&
                            useTEM.teamMemberProfiles[chat.dmPartnerUser.userId] &&
                            useTEM.teamMemberProfiles[chat.dmPartnerUser.userId].customStatus !==
                                "" && (
                                <Typography
                                    level="body-xs"
                                    sx={{
                                        color: styles.subtitleColor,
                                        fontWeight: 500,
                                        fontStyle: "italic",
                                    }}
                                >
                                    {
                                        useTEM.teamMemberProfiles[chat.dmPartnerUser.userId]
                                            .customStatus
                                    }
                                </Typography>
                            )}
                    </>
                )}
            </Stack>
        </Stack>
    );
};
