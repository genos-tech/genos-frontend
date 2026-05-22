import { useState } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { Avatar, Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ModalProjectProfile } from "../../../features/admin/components/modals/ModalProjectProfile";
import { UserProfile } from "../../../features/admin/components/modals/ModalUserProfile";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps } from "../../../types/chat";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type ProjectAvatarProps = {
    socket: Socket | null;
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarSize?: number;
    pmChat: AllChatProps;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const ProjectAvatar = (props: ProjectAvatarProps) => {
    const { useTEM, socket, myself, setMyself, avatarSize, pmChat, useCM, useUISM } = props;
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
                    <AssignmentIcon sx={{ fontSize: 26 }} />
                </Avatar>
            </Box>

            <ModalProjectProfile
                useCM={useCM}
                myself={myself}
                openModalProjectProfile={openModalProjectProfile}
                pmChat={pmChat}
                setAvatarUserId={setAvatarUserId}
                setMyself={setMyself}
                setOpenModalProjectProfile={setOpenModalProjectProfile}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                useTEM={useTEM}
                useUISM={useUISM}
            />

            {avatarUserId && (
                <UserProfile
                    useCM={useCM}
                    isYou={false}
                    myself={myself}
                    openUserProfile={openUserProfile}
                    setMyself={setMyself}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    useUISM={useUISM}
                    user={useTEM.teamMemberProfiles[avatarUserId]}
                />
            )}
        </div>
    );
};
