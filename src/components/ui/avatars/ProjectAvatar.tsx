import { useState } from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import { Socket } from "socket.io-client";

import { ModalProjectProfile } from "../../../features/admin/components/modals/ModalProjectProfile";
import { UserProfile } from "../../../features/admin/components/modals/ModalUserProfile";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps } from "../../../types/chat";
import { buildAvatarSrc } from "../../../utils/avatarSrc";
import { Clickable } from "../Clickable";
import { BaseAvatar } from "./BaseAvatar";

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
            <Clickable
                height={_avatarSize}
                position="relative"
                width={_avatarSize}
                onActivate={() => setOpenModalProjectProfile(true)}
            >
                <BaseAvatar size={_avatarSize} src={buildAvatarSrc(pmChat.profileImagePath)}>
                    <AssignmentIcon />
                </BaseAvatar>
            </Clickable>

            <ModalProjectProfile
                myself={myself}
                openModalProjectProfile={openModalProjectProfile}
                pmChat={pmChat}
                setAvatarUserId={setAvatarUserId}
                setMyself={setMyself}
                setOpenModalProjectProfile={setOpenModalProjectProfile}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
            />

            {avatarUserId && (
                <UserProfile
                    isYou={false}
                    myself={myself}
                    openUserProfile={openUserProfile}
                    setMyself={setMyself}
                    setOpenUserProfile={setOpenUserProfile}
                    socket={socket}
                    useCM={useCM}
                    user={useTEM.teamMemberProfiles[avatarUserId]}
                    useUISM={useUISM}
                />
            )}
        </div>
    );
};
