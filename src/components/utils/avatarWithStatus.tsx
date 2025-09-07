import { Socket } from "socket.io-client";
import { useState } from "react";
import { Box, Avatar } from "@mui/joy";

import { AllChatProps, ChatProps } from "../../types/chat";
import { UserProfile } from "../../features/admin/components/modals/UserProfile";
import { UserProps } from "../../types/admin";
import { ThreadProps } from "../../types/chat";
import { PulseDot } from "../utils/PulseDot";
import { TaskCommentProps } from "../../types/tasks";

type AvatarWithStatusProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarUser?: UserProps;
    socket: Socket | null;
    chat?: AllChatProps;
    thread?: ThreadProps;
    comment?: TaskCommentProps;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
};
export const AvatarWithStatus = (props: AvatarWithStatusProps) => {
    const {
        myself,
        setMyself,
        avatarUser,
        socket,
        chat,
        thread,
        comment,
        setOpeningService,
        setCurrentMainChat,
    } = props;
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);

    const isOnline: boolean = avatarUser
        ? myself.userId === avatarUser.userId
            ? true
            : avatarUser.isOnline || false
        : false;

    return (
        <div>
            <Box
                position="relative"
                width={32}
                height={32}
                onClick={() => setOpenUserProfile(true)}
            >
                {chat && (
                    <Avatar
                        size="sm"
                        sx={{ width: 32, height: 32 }}
                        src={avatarUser?.avatarImgPath}
                    >
                        {chat.chatType === 1
                            ? avatarUser?.userName[0].toUpperCase()
                            : chat?.chatName[0].toUpperCase()}
                    </Avatar>
                )}
                {thread && (
                    <Avatar
                        size="sm"
                        sx={{ width: 32, height: 32 }}
                        src={avatarUser?.avatarImgPath}
                    >
                        {thread.chatType === 1
                            ? avatarUser?.userName[0].toUpperCase()
                            : thread?.chatName[0].toUpperCase()}
                    </Avatar>
                )}
                {comment && (
                    <Avatar
                        size="sm"
                        sx={{ width: 32, height: 32 }}
                        src={avatarUser?.avatarImgPath}
                    >
                        {avatarUser?.userName[0].toUpperCase()}
                    </Avatar>
                )}
                <Box position="absolute" bottom={0} right={0} width={12} height={17}>
                    <PulseDot color={isOnline === true ? "#4caf50" : "#999"} />
                </Box>
            </Box>

            <UserProfile
                socket={socket}
                myself={myself}
                setMyself={setMyself}
                user={avatarUser}
                openUserProfile={openUserProfile}
                setOpenUserProfile={setOpenUserProfile}
                setCurrentMainChat={setCurrentMainChat}
                setOpeningService={setOpeningService}
            />
        </div>
    );
};
