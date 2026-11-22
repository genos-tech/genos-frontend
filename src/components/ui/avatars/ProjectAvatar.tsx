import { useState } from "react";
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
import { ProjectChatAvatar } from "./ChatKindAvatar";

type ProjectAvatarProps = {
    socket: Socket | null;
    useTEM: TeamManagementState;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarSize?: number;
    /**
     * Whether a click opens the project profile (default). A picker passes `false`: the picture of
     * a control opens the control, not another dialog (MIP-1981).
     */
    clickable?: boolean;
    pmChat: AllChatProps;
    useCM: ChatManagementState;
    useUISM: UIStateManagementState;
};
export const ProjectAvatar = (props: ProjectAvatarProps) => {
    const { useTEM, socket, myself, setMyself, avatarSize, pmChat, useCM, useUISM } = props;
    const clickable = props.clickable !== false;
    const [openModalProjectProfile, setOpenModalProjectProfile] = useState<boolean>(false);
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);
    const _avatarSize = avatarSize || 32;
    if (!clickable) {
        return (
            <ProjectChatAvatar size={_avatarSize} src={buildAvatarSrc(pmChat.profileImagePath)} />
        );
    }
    return (
        <div>
            <Clickable
                height={_avatarSize}
                position="relative"
                width={_avatarSize}
                onActivate={() => setOpenModalProjectProfile(true)}
            >
                <ProjectChatAvatar
                    size={_avatarSize}
                    src={buildAvatarSrc(pmChat.profileImagePath)}
                />
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
