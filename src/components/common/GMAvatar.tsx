import GroupsIcon from "@mui/icons-material/Groups";
import { Avatar, Box } from "@mui/joy";
import { useEffect, useState } from "react";
import { Socket } from "socket.io-client";

import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { ModalGMProfile } from "../../features/chat/components/modals/ModalGMProfile";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps } from "../../types/chat";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type GMAvatarProps = {
    socket: Socket | null;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarSize?: number;
    isYou: boolean;
    gmChat: AllChatProps;
    funcSetAllChats: () => Promise<void>;
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (service: number) => void;
};
export const GMAvatar = (props: GMAvatarProps) => {
    const {
        socket,
        teamMemberProfiles,
        myself,
        setMyself,
        avatarSize,
        isYou,
        gmChat,
        funcSetAllChats,
        setCurrentMainChat,
        setOpeningService,
    } = props;
    const [openModalGMProfile, setOpenModalGMProfile] = useState<boolean>(false);
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);
    const _avatarSize = avatarSize || 32;

    return (
        <div>
            <Box
                height={_avatarSize}
                position="relative"
                width={_avatarSize}
                onClick={() => setOpenModalGMProfile(true)}
            >
                <Avatar
                    size="sm"
                    src={`${media_url}/${gmChat.profileImagePath}`}
                    sx={{ width: _avatarSize, height: _avatarSize }}
                >
                    <GroupsIcon sx={{ fontSize: 26 }} />
                </Avatar>
            </Box>

            <ModalGMProfile
                funcSetAllChats={funcSetAllChats}
                gmChat={gmChat}
                myself={myself}
                openModalGMProfile={openModalGMProfile}
                setAvatarUserId={setAvatarUserId}
                setCurrentMainChat={setCurrentMainChat}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                setOpenModalGMProfile={setOpenModalGMProfile}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                teamMemberProfiles={teamMemberProfiles}
            />

            {avatarUserId && (
                <UserProfile
                    isYou={isYou}
                    myself={myself}
                    openUserProfile={openUserProfile}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    user={teamMemberProfiles[avatarUserId]}
                />
            )}
        </div>
    );
};
