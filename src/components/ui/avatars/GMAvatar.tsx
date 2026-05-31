import { useMemo, useState } from "react";
import GroupsIcon from "@mui/icons-material/Groups";
import { Avatar, Box } from "@mui/joy";
import { Socket } from "socket.io-client";

import { UserProfile } from "../../../features/admin/components/modals/ModalUserProfile";
import { ModalGMProfile } from "../../../features/chat/components/modals/ModalGMProfile";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../types/admin";
import { AllChatProps } from "../../../types/chat";
import { useGMProfileImageVersion } from "../../../utils/gmProfileImageVersion";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

type GMAvatarProps = {
    useTEM: TeamManagementState;
    socket: Socket | null;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    avatarSize?: number;
    isYou: boolean;
    gmChat: AllChatProps;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
};
export const GMAvatar = (props: GMAvatarProps) => {
    const { useTEM, socket, myself, setMyself, avatarSize, isYou, gmChat, useUISM, useCM } = props;
    const [openModalGMProfile, setOpenModalGMProfile] = useState<boolean>(false);
    const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
    const [avatarUserId, setAvatarUserId] = useState<string | undefined>(undefined);
    const _avatarSize = avatarSize || 32;

    // Look up the chat from `useCM.allChats` so the avatar reflects
    // the canonical profile image even when callers (e.g. note
    // headers, sidebar lists) pass a stale `chat` object that was
    // captured before an upload. Falls back to the prop the very
    // first render in case `funcSetAllChats` hasn't populated yet.
    const liveChat = useMemo<AllChatProps>(() => {
        const found = useCM.allChats.find(
            (c) => c.chatId === gmChat.chatId && c.chatType === gmChat.chatType
        );
        return found ?? gmChat;
    }, [useCM.allChats, gmChat]);

    // `?v=` cache buster — see `gmProfileImageVersion` for the
    // module-level pub-sub. Bumps on every successful upload so the
    // browser refetches even when the backend reuses the filename.
    // PUNCH LIST (v3 chatId migration): `gmChat.chatId` is `string`
    // post-flip; `useGMProfileImageVersion` still keys by numeric chatId
    // (legacy pub-sub channel). Cast once at the boundary.
    const imageVersion = useGMProfileImageVersion(
        gmChat.chatType,
        gmChat.chatId as unknown as number
    );
    const avatarSrc = liveChat.profileImagePath
        ? `${media_url}/${liveChat.profileImagePath}${imageVersion > 0 ? `?v=${imageVersion}` : ""}`
        : undefined;

    return (
        <div>
            <Box
                height={_avatarSize}
                position="relative"
                width={_avatarSize}
                onClick={() => setOpenModalGMProfile(true)}
            >
                <Avatar size="sm" src={avatarSrc} sx={{ width: _avatarSize, height: _avatarSize }}>
                    <GroupsIcon sx={{ fontSize: 26 }} />
                </Avatar>
            </Box>

            <ModalGMProfile
                gmChat={liveChat}
                myself={myself}
                openModalGMProfile={openModalGMProfile}
                setAvatarUserId={setAvatarUserId}
                setMyself={setMyself}
                setOpenModalGMProfile={setOpenModalGMProfile}
                setOpenUserProfile={setOpenUserProfile}
                socket={socket}
                useCM={useCM}
                useTEM={useTEM}
                useUISM={useUISM}
            />

            {avatarUserId && (
                <UserProfile
                    isYou={isYou}
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
