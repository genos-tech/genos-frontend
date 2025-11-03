import LockOutlineIcon from "@mui/icons-material/LockOutline";
import { Box, Chip, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";
import { PulseDot } from "../../../../components/utils/PulseDot";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { ChatProps } from "../../../../types/chat";

type HeaderUserNameProps = {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    UIM: UIStateManagementState;
    chat?: ChatProps;
    isYou: boolean;
    CM: ChatManagementState;
};
export const HeaderUserName = (props: HeaderUserNameProps) => {
    const { TEM, socket, myself, setMyself, UIM, chat, isYou, CM } = props;

    const headerUser: UserProps | undefined = chat
        ? TEM.teamMemberProfiles[chat.dmPartnerUser.userId]
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
                        avatarSize={38}
                        avatarUser={headerUser}
                        chat={chat}
                        CM={CM}
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        UIM={UIM}
                    />
                ) : chat && chat.chatType === 2 ? (
                    <GMAvatar
                        avatarSize={38}
                        CM={CM}
                        gmChat={chat}
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        TEM={TEM}
                        UIM={UIM}
                    />
                ) : chat && chat.chatType === 3 ? (
                    <ProjectAvatar
                        avatarSize={38}
                        CM={CM}
                        myself={myself}
                        pmChat={chat}
                        setMyself={setMyself}
                        socket={socket}
                        TEM={TEM}
                        UIM={UIM}
                    />
                ) : undefined}
            </div>
            <div>
                <Stack direction={"row"}>
                    <Typography
                        component="h2"
                        sx={{ fontWeight: "lg", fontSize: "lg" }}
                        endDecorator={
                            chat && chat.chatType === 1 ? (
                                <Chip
                                    color="neutral"
                                    size="md"
                                    slotProps={{ root: { component: "span" } }}
                                    sx={{ borderRadius: "sm" }}
                                    variant="outlined"
                                    startDecorator={
                                        <Box sx={{ ml: "-5px" }}>
                                            <PulseDot
                                                color={isOnline === true ? "#4caf50" : "#999"}
                                            />
                                        </Box>
                                    }
                                >
                                    {isOnline === true ? "Online" : "Offline"}
                                </Chip>
                            ) : undefined
                        }
                        startDecorator={
                            chat && chat.isPrivate ? (
                                <LockOutlineIcon sx={{ fontSize: "22px" }} />
                            ) : undefined
                        }
                        noWrap
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
                                size="md"
                                sx={{ ml: "3px", borderRadius: "sm" }}
                                variant="outlined"
                            >
                                {myself.customStatus}
                            </Chip>
                        )}

                    {/* show others custom status */}
                    {chat &&
                        chat.dmPartnerUser.userId !== "" &&
                        myself.userId !== chat.dmPartnerUser.userId &&
                        TEM.teamMemberProfiles[chat.dmPartnerUser.userId] &&
                        TEM.teamMemberProfiles[chat.dmPartnerUser.userId].customStatus !== "" && (
                            <Chip
                                component="h2"
                                size="md"
                                sx={{ ml: "3px", borderRadius: "sm" }}
                                variant="outlined"
                            >
                                {TEM.teamMemberProfiles[chat.dmPartnerUser.userId].customStatus}
                            </Chip>
                        )}
                </Stack>
            </div>
        </>
    );
};
