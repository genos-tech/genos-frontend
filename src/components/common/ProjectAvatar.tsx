import { useState } from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import { Avatar, Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ModalProjectProfile } from "../../features/admin/components/modals/ModalProjectProfile";
import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { UIStateManagementState } from "../../hooks/common/useUIStateManagement";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps } from "../../types/chat";

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
    UIM: UIStateManagementState;
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
        UIM,
    } = props;
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
                funcSetAllChats={funcSetAllChats}
                myself={myself}
                openModalProjectProfile={openModalProjectProfile}
                pmChat={pmChat}
                setAvatarUserId={setAvatarUserId}
                setCurrentMainChat={setCurrentMainChat}
                setMyself={setMyself}
                UIM={UIM}
                setOpenModalProjectProfile={setOpenModalProjectProfile}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                teamMemberProfiles={teamMemberProfiles}
            />

            {avatarUserId && (
                <UserProfile
                    isYou={false}
                    myself={myself}
                    openUserProfile={openUserProfile}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    UIM={UIM}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    user={teamMemberProfiles[avatarUserId]}
                />
            )}
        </div>
    );
};
