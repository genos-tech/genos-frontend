import { useEffect, useState } from "react";
import { Box, Avatar } from "@mui/joy";
import GroupsIcon from "@mui/icons-material/Groups";

import { AllChatProps, ChatProps } from "../../../types/chat";
import { UserProps } from "../../../types/admin";
import { ModalGMProfile } from "./modals/ModalGMProfile";
import { UserProfile } from "../../admin/components/modals/UserProfile";
import { Socket } from "socket.io-client";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type GMAvatarProps = {
    socket: Socket | null;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
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
        isYou,
        gmChat,
        funcSetAllChats,
        setCurrentMainChat,
        setOpeningService,
    } = props;
    const [openModalGMProfile, setOpenModalGMProfile] = useState<boolean>(false);
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);

    return (
        <div>
            <Box
                position="relative"
                width={32}
                height={32}
                onClick={() => setOpenModalGMProfile(true)}
            >
                <Avatar
                    size="sm"
                    sx={{ width: 32, height: 32 }}
                    src={`${media_url}/${gmChat.profileImagePath}`}
                >
                    <GroupsIcon sx={{ fontSize: 32 }} />
                </Avatar>
            </Box>

            <ModalGMProfile
                teamMemberProfiles={teamMemberProfiles}
                myself={myself}
                gmChat={gmChat}
                openModalGMProfile={openModalGMProfile}
                setOpenModalGMProfile={setOpenModalGMProfile}
                funcSetAllChats={funcSetAllChats}
                setAvatarUserId={setAvatarUserId}
                setOpenUserProfile={setOpenUserProfile}
            />

            {avatarUserId && (
                <UserProfile
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
                    isYou={isYou}
                    user={teamMemberProfiles[avatarUserId]}
                    openUserProfile={openUserProfile}
                    setOpenUserProfile={setOpenUserProfile}
                    setCurrentMainChat={setCurrentMainChat}
                    setOpeningService={setOpeningService}
                />
            )}
        </div>
    );
};
