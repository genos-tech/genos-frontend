import { Socket } from "socket.io-client";
import { Box, Chip, Stack, Typography } from "@mui/joy";
import LockOutlineIcon from "@mui/icons-material/LockOutline";

import { ChatProps } from "../../../../types/chat";
import { PulseDot } from "../../../../components/utils/PulseDot";
import { UserProps } from "../../../../types/admin";
import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";

type HeaderUserNameProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    chat?: ChatProps;
    isYou: boolean;
    funcSetAllChats: () => Promise<void>;
};
export const HeaderUserName = (props: HeaderUserNameProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        setOpeningService,
        setCurrentMainChat,
        chat,
        isYou,
        funcSetAllChats,
    } = props;

    const headerUser: UserProps | undefined = chat
        ? teamMemberProfiles[chat.dmPartnerUser.userId]
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
        <>
            <div>
                {chat && chat.chatType === 1 ? (
                    <AvatarWithStatus
                        myself={myself}
                        setMyself={setMyself}
                        avatarSize={38}
                        isYou={isYou}
                        avatarUser={headerUser}
                        socket={socket}
                        chat={chat}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={setCurrentMainChat}
                    />
                ) : chat && chat.chatType === 2 ? (
                    <GMAvatar
                        teamMemberProfiles={teamMemberProfiles}
                        myself={myself}
                        setMyself={setMyself}
                        avatarSize={38}
                        isYou={isYou}
                        socket={socket}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={setCurrentMainChat}
                        gmChat={chat}
                        funcSetAllChats={funcSetAllChats}
                    />
                ) : chat && chat.chatType === 3 ? (
                    <ProjectAvatar
                        teamMemberProfiles={teamMemberProfiles}
                        myself={myself}
                        setMyself={setMyself}
                        avatarSize={38}
                        socket={socket}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={setCurrentMainChat}
                        pmChat={chat}
                        funcSetAllChats={funcSetAllChats}
                    />
                ) : undefined}
            </div>
            <div>
                <Stack direction={"row"}>
                    <Typography
                        component="h2"
                        noWrap
                        startDecorator={
                            chat && chat.isPrivate ? (
                                <LockOutlineIcon sx={{ fontSize: "22px" }} />
                            ) : undefined
                        }
                        endDecorator={
                            chat && chat.chatType === 1 ? (
                                <Chip
                                    variant="outlined"
                                    size="md"
                                    color="neutral"
                                    sx={{ borderRadius: "sm" }}
                                    startDecorator={
                                        <Box sx={{ ml: "-5px" }}>
                                            <PulseDot
                                                color={isOnline === true ? "#4caf50" : "#999"}
                                            />
                                        </Box>
                                    }
                                    slotProps={{ root: { component: "span" } }}
                                >
                                    {isOnline === true ? "Online" : "Offline"}
                                </Chip>
                            ) : undefined
                        }
                        sx={{ fontWeight: "lg", fontSize: "lg" }}
                    >
                        {isYou ? `${chat?.chatName} (you)` : chat?.chatName}
                    </Typography>

                    {/* show my own custom status */}
                    {chat &&
                        chat.dmPartnerUser.userId !== "" &&
                        myself.userId === chat.dmPartnerUser.userId &&
                        myself.customStatus != "" && (
                            <Chip
                                component="h2"
                                variant="outlined"
                                size="md"
                                sx={{ ml: "3px", borderRadius: "sm" }}
                            >
                                {myself.customStatus}
                            </Chip>
                        )}

                    {/* show others custom status */}
                    {chat &&
                        chat.dmPartnerUser.userId !== "" &&
                        myself.userId !== chat.dmPartnerUser.userId &&
                        teamMemberProfiles[chat.dmPartnerUser.userId] &&
                        teamMemberProfiles[chat.dmPartnerUser.userId].customStatus !== "" && (
                            <Chip
                                component="h2"
                                variant="outlined"
                                size="md"
                                sx={{ ml: "3px", borderRadius: "sm" }}
                            >
                                {teamMemberProfiles[chat.dmPartnerUser.userId].customStatus}
                            </Chip>
                        )}
                </Stack>
            </div>
        </>
    );
};
