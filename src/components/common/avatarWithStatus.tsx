import { Avatar, Box, Stack, Typography } from "@mui/joy";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps, ThreadProps } from "../../types/chat";
import { PulseDot } from "../utils/PulseDot";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type AvatarWithStatusProps = {
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarSize?: number;
    isYou: boolean;
    avatarUser?: UserProps;
    socket: Socket | null;
    isForBubble?: boolean;
    chat?: AllChatProps;
    thread?: ThreadProps;
    setOpeningService: (service: number) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    showNameAndEmail?: boolean;
};
export const AvatarWithStatus = (props: AvatarWithStatusProps) => {
    const {
        myself,
        setMyself,
        avatarSize,
        isYou,
        avatarUser,
        socket,
        isForBubble,
        chat,
        thread,
        setOpeningService,
        setCurrentMainChat,
        showNameAndEmail,
    } = props;
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const _avatarSize = avatarSize || 32;
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
            <Stack direction="row" spacing={1}>
                <Box
                    height={_avatarSize}
                    position="relative"
                    width={_avatarSize}
                    onClick={() => setOpenUserProfile(true)}
                >
                    {chat && (
                        <Avatar
                            size="sm"
                            src={`${media_url}/${avatarImg}`}
                            sx={{ width: _avatarSize, height: _avatarSize }}
                        >
                            {chat.chatType === 1 || isForBubble === true
                                ? avatarUser?.userName[0].toUpperCase()
                                : chat?.chatName[0].toUpperCase()}
                        </Avatar>
                    )}
                    {thread && (
                        <Avatar
                            size="sm"
                            src={`${media_url}/${avatarImg}`}
                            sx={{ width: _avatarSize, height: _avatarSize }}
                        >
                            {thread.chatType === 1 || isForBubble === true
                                ? avatarUser?.userName[0].toUpperCase()
                                : thread?.chatName[0].toUpperCase()}
                        </Avatar>
                    )}
                    {chat === undefined && thread === undefined && (
                        <Avatar
                            size="sm"
                            src={`${media_url}/${avatarImg}`}
                            sx={{ width: _avatarSize, height: _avatarSize }}
                        >
                            {avatarUser?.userName[0].toUpperCase()}
                        </Avatar>
                    )}
                    <Box bottom={0} height={17} position="absolute" right={0} width={12}>
                        <PulseDot color={isOnline === true ? "#4caf50" : "#999"} />
                    </Box>
                </Box>
                {showNameAndEmail === true && (
                    <Typography
                        fontWeight={"bold"}
                        sx={{
                            pt: "3px",
                            pl: "5px",
                            userSelect: "text",
                        }}
                        onClick={() => setOpenUserProfile(true)}
                    >
                        {avatarUser?.userName} - {avatarUser?.userEmail}
                    </Typography>
                )}
            </Stack>

            <UserProfile
                isYou={isYou}
                myself={myself}
                openUserProfile={openUserProfile}
                setCurrentMainChat={setCurrentMainChat}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                user={avatarUser}
            />
        </div>
    );
};
