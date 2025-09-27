import { Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import { Box, Avatar } from "@mui/joy";

import { AllChatProps, ChatProps } from "../../types/chat";
import { UserProfile } from "../../features/admin/components/modals/UserProfile";
import { UserProps } from "../../types/admin";
import { ThreadProps } from "../../types/chat";
import { PulseDot } from "../utils/PulseDot";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type AvatarWithStatusProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    isYou: boolean;
    avatarUser?: UserProps;
    socket: Socket | null;
    isForBubble?: boolean;
    chat?: AllChatProps;
    thread?: ThreadProps;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
};
export const AvatarWithStatus = (props: AvatarWithStatusProps) => {
    const {
        myself,
        setMyself,
        isYou,
        avatarUser,
        socket,
        isForBubble,
        chat,
        thread,
        setOpeningService,
        setCurrentMainChat,
    } = props;
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);

    let isOnline: boolean;
    isOnline = avatarUser
        ? myself.userId === avatarUser.userId
            ? myself?.isOfflineForced !== "true"
                ? true
                : false
            : avatarUser.isOnline === true && avatarUser.isOfflineForced !== "true"
            ? true
            : false
        : false;

    const setAvatarImg = (): string => {
        if (isYou === true) {
            isOnline = myself?.isOfflineForced !== "true" ? true : false;
            return myself.avatarImgPath;
        } else {
            return avatarUser?.avatarImgPath || "";
        }
    };

    let avatarImg: string = setAvatarImg();

    useEffect(() => {
        avatarImg = setAvatarImg();
    }, [myself]);

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
                        src={`${media_url}/${avatarImg}`}
                    >
                        {chat.chatType === 1 || isForBubble === true
                            ? avatarUser?.userName[0].toUpperCase()
                            : chat?.chatName[0].toUpperCase()}
                    </Avatar>
                )}
                {thread && (
                    <Avatar
                        size="sm"
                        sx={{ width: 32, height: 32 }}
                        src={`${media_url}/${avatarImg}`}
                    >
                        {thread.chatType === 1 || isForBubble === true
                            ? avatarUser?.userName[0].toUpperCase()
                            : thread?.chatName[0].toUpperCase()}
                    </Avatar>
                )}
                {chat === undefined && thread === undefined && (
                    <Avatar
                        size="sm"
                        sx={{ width: 32, height: 32 }}
                        src={`${media_url}/${avatarImg}`}
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
                isYou={isYou}
                user={avatarUser}
                openUserProfile={openUserProfile}
                setOpenUserProfile={setOpenUserProfile}
                setCurrentMainChat={setCurrentMainChat}
                setOpeningService={setOpeningService}
            />
        </div>
    );
};
