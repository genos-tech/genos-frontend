import { Socket } from "socket.io-client";
import { useState } from "react";
import { Box, Avatar } from "@mui/joy";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

import { AllChatProps, ChatProps } from "../../types/chat";
import { UserProps } from "../../types/admin";
import { ModalProjectProfile } from "../../features/admin/components/modals/ModalProjectProfile";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type ProjectAvatarProps = {
    socket: Socket | null;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarSize?: number;
    pmChat: AllChatProps;
    funcSetAllChats: () => Promise<void>;
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (service: number) => void;
};
export const ProjectAvatar = (props: ProjectAvatarProps) => {
    const {
        socket,
        teamMemberProfiles,
        myself,
        setMyself,
        avatarSize,
        pmChat,
        funcSetAllChats,
        setCurrentMainChat,
        setOpeningService,
    } = props;
    const [openModalProjectProfile, setOpenModalProjectProfile] = useState<boolean>(false);
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);
    const _avatarSize = avatarSize || 32;
    return (
        <div>
            <Box
                position="relative"
                width={_avatarSize}
                height={_avatarSize}
                onClick={() => setOpenModalProjectProfile(true)}
            >
                <Avatar
                    size="sm"
                    sx={{ width: _avatarSize, height: _avatarSize }}
                    src={`${media_url}/${pmChat.profileImagePath}`}
                >
                    <AccountTreeIcon sx={{ fontSize: 26 }} />
                </Avatar>
            </Box>

            <ModalProjectProfile
                socket={socket}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                teamMemberProfiles={teamMemberProfiles}
                myself={myself}
                pmChat={pmChat}
                openModalProjectProfile={openModalProjectProfile}
                setOpenModalProjectProfile={setOpenModalProjectProfile}
                funcSetAllChats={funcSetAllChats}
                setAvatarUserId={setAvatarUserId}
                setOpenUserProfile={setOpenUserProfile}
                setCurrentMainChat={setCurrentMainChat}
            />

            {avatarUserId && (
                <UserProfile
                    socket={socket}
                    myself={myself}
                    setMyself={setMyself}
                    isYou={false}
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
