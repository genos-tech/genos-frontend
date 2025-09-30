import { Socket } from "socket.io-client";
import { useEffect, useState } from "react";
import { Box, Avatar } from "@mui/joy";
import AccountTreeIcon from "@mui/icons-material/AccountTree";

import { AllChatProps, ChatProps } from "../../../types/chat";
import { UserProps } from "../../../types/admin";
import { ModalProjectProfile } from "./modals/ModalProjectProfile";
import { UserProfile } from "../../../features/admin/components/modals/UserProfile";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type ProjectAvatarProps = {
    socket: Socket | null;
    teamMemberProfiles: Record<string, UserProps>;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    isYou: boolean;
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
        isYou,
        pmChat,
        funcSetAllChats,
        setCurrentMainChat,
        setOpeningService,
    } = props;
    const [openModalProjectProfile, setOpenModalProjectProfile] = useState<boolean>(false);
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);

    return (
        <div>
            <Box
                position="relative"
                width={32}
                height={32}
                onClick={() => setOpenModalProjectProfile(true)}
            >
                <Avatar
                    size="sm"
                    sx={{ width: 32, height: 32 }}
                    src={`${media_url}/${pmChat.profileImagePath}`}
                >
                    <AccountTreeIcon sx={{ fontSize: 22 }} />
                </Avatar>
            </Box>

            <ModalProjectProfile
                teamMemberProfiles={teamMemberProfiles}
                myself={myself}
                pmChat={pmChat}
                openModalProjectProfile={openModalProjectProfile}
                setOpenModalProjectProfile={setOpenModalProjectProfile}
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
