import { Socket } from "socket.io-client";
import { useState } from "react";
import { Avatar, Box, Chip, Stack, Typography } from "@mui/joy";
import GroupsIcon from "@mui/icons-material/Groups";

import { ChatProps } from "../../../../types/chat";
import { PulseDot } from "../../../../components/utils/PulseDot";
import { UserProfile } from "../../../admin/components/modals/UserProfile";
import { UserProps } from "../../../../types/admin";
import { AvatarWithStatus } from "../../../../components/utils/avatarWithStatus";

type HeaderUserNameProps = {
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    isOnline: boolean;
    chat: ChatProps;
    isYou: boolean;
};
export const HeaderUserName = (props: HeaderUserNameProps) => {
    const {
        teamMemberProfiles,
        socket,
        myself,
        setMyself,
        setOpeningService,
        setCurrentMainChat,
        isOnline,
        chat,
        isYou,
    } = props;

    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);

    return (
        <>
            <div>
                {chat.chatType === 1 ? (
                    <AvatarWithStatus
                        myself={myself}
                        setMyself={setMyself}
                        avatarUser={
                            teamMemberProfiles[chat.dmPartnerUser ? chat.dmPartnerUser.userId : ""]
                        }
                        socket={socket}
                        chat={chat}
                        setOpeningService={setOpeningService}
                        setCurrentMainChat={setCurrentMainChat}
                    />
                ) : (
                    <Avatar>
                        <GroupsIcon sx={{ fontSize: 32 }} />
                    </Avatar>
                )}
            </div>
            <div>
                <Stack direction={"row"}>
                    <Typography
                        component="h2"
                        noWrap
                        endDecorator={
                            chat.chatType === 1 ? (
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
                        {isYou ? `${chat.chatName} (you)` : chat.chatName}
                    </Typography>

                    {/* show my own custom status */}
                    {chat.dmPartnerUser !== null &&
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
                    {chat.dmPartnerUser !== null &&
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
            {chat.dmPartnerUser && (
                <UserProfile
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
                    user={teamMemberProfiles[chat.dmPartnerUser?.userId]}
                    openUserProfile={openUserProfile}
                    setOpenUserProfile={setOpenUserProfile}
                    setCurrentMainChat={setCurrentMainChat}
                    setOpeningService={setOpeningService}
                />
            )}
        </>
    );
};
