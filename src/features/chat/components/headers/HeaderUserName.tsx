import LockOutlinedIcon from "@mui/icons-material/LockOutlined";
import { Box, Chip, Stack, Typography } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AppTooltip } from "../../../../components/ui/AppTooltip";
import { resolveDisplayName } from "../../../../components/ui/avatars/AvatarContext";
import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { MDMAvatar } from "../../../../components/ui/avatars/MDMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
import { PulseDot } from "../../../../components/ui/misc/PulseDot";
import { HeaderUserNameStyles } from "../../../../components/ui/styles/commonStyle";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { useIsMobile } from "../../../../hooks/common/useIsMobile";
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
    const isMobile = useIsMobile();
    const styles = isDark ? HeaderUserNameStyles.dark : HeaderUserNameStyles.light;

    const mdmMembers =
        chat?.chatType === 4
            ? useCM.allChats.find((c) => c.chatId === chat.chatId && c.chatType === 4)?.mdmMembers
            : undefined;
    const mdmDisplayName = (() => {
        if (!mdmMembers || mdmMembers.length === 0) return chat?.chatName;
        const MAX_DISPLAY = 3;
        // Resolve each member's CURRENT name so a rename shows in the header.
        const names = mdmMembers.map((m) =>
            resolveDisplayName(m.userId, m.userName, myself, useTEM.teamMemberProfiles)
        );
        if (names.length <= MAX_DISPLAY) return names.join(", ");
        return `${names.slice(0, MAX_DISPLAY).join(", ")} +${names.length - MAX_DISPLAY}`;
    })();

    // For a DM the header title is the partner's name (cached on the chat
    // row); resolve it live so a rename — including your own in a self-DM —
    // shows immediately. GM/PM keep their group/project `chatName`.
    const dmDisplayName =
        chat?.chatType === 1 && chat.dmPartnerUser?.userId
            ? resolveDisplayName(
                  chat.dmPartnerUser.userId,
                  chat.chatName ?? "",
                  myself,
                  useTEM.teamMemberProfiles
              )
            : chat?.chatName;

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
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useUISM={useUISM}
                    />
                ) : chat && chat.chatType === 2 ? (
                    <GMAvatar
                        avatarSize={38}
                        gmChat={chat}
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                ) : chat && chat.chatType === 3 ? (
                    <ProjectAvatar
                        avatarSize={38}
                        myself={myself}
                        pmChat={chat}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                ) : chat && chat.chatType === 4 ? (
                    <MDMAvatar
                        size="md"
                        teamMemberProfiles={useTEM.teamMemberProfiles}
                        members={
                            useCM.allChats.find(
                                (c) => c.chatId === chat.chatId && c.chatType === 4
                            )?.mdmMembers
                        }
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
                        <AppTooltip
                            placement="bottom"
                            title={
                                useCM.allChats
                                    .find((c) => c.chatId === chat.chatId && c.chatType === 4)
                                    ?.mdmMembers?.map((m) =>
                                        resolveDisplayName(
                                            m.userId,
                                            m.userName,
                                            myself,
                                            useTEM.teamMemberProfiles
                                        )
                                    )
                                    .join(", ") || chat?.chatName
                            }
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
                                {mdmDisplayName || chat?.chatName}
                            </Typography>
                        </AppTooltip>
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
                            {isYou ? `${dmDisplayName} (you)` : dmDisplayName}
                        </Typography>
                    )}

                    {/* Online/Offline status chip */}
                    {chat && chat.chatType === 1 && !isMobile && (
                        <Chip
                            size="sm"
                            variant="soft"
                            startDecorator={
                                <PulseDot
                                    color={isOnline ? styles.onlineColor : styles.offlineColor}
                                />
                            }
                            sx={{
                                height: 24,
                                borderRadius: "8px",
                                background: styles.chipBg,
                                border: `1px solid ${styles.chipBorder}`,
                                fontWeight: 600,
                                fontSize: "11px",
                                px: 0.75,
                            }}
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
