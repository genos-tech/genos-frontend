import { Socket } from "socket.io-client";
import { useState } from "react";
import { Box, Badge, Avatar } from "@mui/joy";

import { AllChatProps, ChatProps } from "../../types/chat";
import { UserProfile } from "../../features/admin/components/modals/UserProfile";
import { UserProps } from "../../types/admin";
import { ThreadProps } from "../../types/chat";
import { PulseDot } from "../utils/PulseDot";

type AvatarWithStatusProps = {
    myself: UserProps;
    avatarUser: UserProps;
    isOnline: boolean;
    socket: Socket | null;
    chat?: AllChatProps;
    thread?: ThreadProps;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
};
export const AvatarWithStatus = (props: AvatarWithStatusProps) => {
    const {
        myself,
        avatarUser,
        isOnline,
        socket,
        chat,
        thread,
        setOpeningService,
        setCurrentMainChat,
    } = props;
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);

    return (
        <div>
            <Box position="relative" width={32} height={32}>
                <Avatar
                    size="sm"
                    sx={{ width: 32, height: 32 }}
                    onClick={() => setOpenUserProfile(true)}
                    src={avatarUser.avatarImgPath}
                >
                    {chat !== undefined || thread !== undefined
                        ? chat
                            ? chat?.chatName[0]
                            : thread?.chatName[0]
                        : avatarUser.userName[0]}
                </Avatar>
                <Box position="absolute" bottom={0} right={0} width={12} height={17}>
                    <PulseDot color={isOnline === true ? "#4caf50" : "#999"} />
                </Box>
            </Box>

            <UserProfile
                socket={socket}
                myself={myself}
                user={avatarUser}
                isOnline={isOnline}
                openUserProfile={openUserProfile}
                setOpenUserProfile={setOpenUserProfile}
                setCurrentMainChat={setCurrentMainChat}
                setOpeningService={setOpeningService}
            />
        </div>
    );
};
