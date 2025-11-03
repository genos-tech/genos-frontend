import GroupsIcon from "@mui/icons-material/Groups";
import { Avatar, Box } from "@mui/joy";
import { useState } from "react";
import { Socket } from "socket.io-client";

import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { ModalGMProfile } from "../../features/chat/components/modals/ModalGMProfile";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { AllChatProps } from "../../types/chat";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type GMAvatarProps = {
    TEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarSize?: number;
    isYou: boolean;
    gmChat: AllChatProps;
    UIM: UIStateManagementState;
    CM: ChatManagementState;
};
export const GMAvatar = (props: GMAvatarProps) => {
    const { TEM, socket, myself, setMyself, avatarSize, isYou, gmChat, UIM, CM } = props;
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
                CM={CM}
                gmChat={gmChat}
                myself={myself}
                openModalGMProfile={openModalGMProfile}
                setAvatarUserId={setAvatarUserId}
                setMyself={setMyself}
                setOpenModalGMProfile={setOpenModalGMProfile}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                TEM={TEM}
                UIM={UIM}
            />

            {avatarUserId && (
                <UserProfile
                    CM={CM}
                    isYou={isYou}
                    myself={myself}
                    openUserProfile={openUserProfile}
                    setMyself={setMyself}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    UIM={UIM}
                    user={TEM.teamMemberProfiles[avatarUserId]}
                />
            )}
        </div>
    );
};
