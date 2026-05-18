import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Chip, Stack, Tooltip, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { PulseDot } from "../../../../components/ui/misc/PulseDot";
import { HeaderUserNameStyles } from "../../../../components/ui/styles/commonStyle";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { useTranslation } from "../../../../i18n";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";

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
    const { t } = useTranslation();
    const isDark = mode === "dark";
    const styles = isDark ? HeaderUserNameStyles.dark : HeaderUserNameStyles.light;

    const mdmMembers =
        chat?.chatType === 4
            ? useCM.allChats.find((c) => c.chatId === chat.chatId && c.chatType === 4)?.mdmMembers
            : undefined;
    const mdmDisplayName = (() => {
        if (!mdmMembers || mdmMembers.length === 0) return chat?.chatName;
        const MAX_DISPLAY = 3;
        const names = mdmMembers.map((m) => m.userName);
        if (names.length <= MAX_DISPLAY) return names.join(", ");
        return `${names.slice(0, MAX_DISPLAY).join(", ")} +${names.length - MAX_DISPLAY}`;
    })();

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
                        background: isDark ? "rgba(124,58,237,0.15)" : "rgba(124,58,237,0.1)",
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
                        teamMemberProfiles={useTEM.teamMemberProfiles}
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
                            variant="outlined"
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
                                {mdmDisplayName || chat?.chatName}
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
                                {isOnline ? t.chat.headers.online : t.chat.headers.offline}
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
