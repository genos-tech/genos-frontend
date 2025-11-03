import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { Avatar, Box } from "@mui/joy";
import { useState } from "react";
import { Socket } from "socket.io-client";

import { ModalProjectProfile } from "../../features/admin/components/modals/ModalProjectProfile";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { ChatManagementState } from "../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { AllChatProps } from "../../types/chat";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type ProjectAvatarProps = {
    socket: Socket | null;
    TEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarSize?: number;
    pmChat: AllChatProps;
    CM: ChatManagementState;
    UIM: UIStateManagementState;
};
export const ProjectAvatar = (props: ProjectAvatarProps) => {
    const { TEM, socket, myself, setMyself, avatarSize, pmChat, CM, UIM } = props;
    const [openModalProjectProfile, setOpenModalProjectProfile] = useState<boolean>(false);
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);
    const _avatarSize = avatarSize || 32;
    return (
        <div>
            <Box
                height={_avatarSize}
                position="relative"
                width={_avatarSize}
                onClick={() => setOpenModalProjectProfile(true)}
            >
                <Avatar
                    size="sm"
                    src={`${media_url}/${pmChat.profileImagePath}`}
                    sx={{ width: _avatarSize, height: _avatarSize }}
                >
                    <AccountTreeIcon sx={{ fontSize: 26 }} />
                </Avatar>
            </Box>

            <ModalProjectProfile
                CM={CM}
                myself={myself}
                openModalProjectProfile={openModalProjectProfile}
                pmChat={pmChat}
                setAvatarUserId={setAvatarUserId}
                setMyself={setMyself}
                setOpenModalProjectProfile={setOpenModalProjectProfile}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                TEM={TEM}
                UIM={UIM}
            />

            {avatarUserId && (
                <UserProfile
                    CM={CM}
                    isYou={false}
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
