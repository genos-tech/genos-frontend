import React from "react";
import { Avatar } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";

interface ChatListItemAvatarProps {
    chat: AllChatProps;
    chatType: number;
    isYou: boolean;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    UIM: UIStateManagementState;
    socket: Socket | null;
    TEM: TeamManagementState;
    funcSetAllChats: () => Promise<void>;
}

export const ChatListItemAvatar: React.FC<ChatListItemAvatarProps> = ({
    TEM,
    chat,
    chatType,
    isYou,
    myself,
    setMyself,
    setCurrentMainChat,
    UIM,
    socket,
    funcSetAllChats,
}) => {
    // DM Chat with partner
    if (chatType === 1 && chat.dmPartnerUser.userId !== "") {
        return (
            <AvatarWithStatus
                avatarUser={TEM.teamMemberProfiles[chat.dmPartnerUser.userId]}
                chat={chat}
                isYou={isYou}
                myself={myself}
                setCurrentMainChat={setCurrentMainChat}
                setMyself={setMyself}
                UIM={UIM}
                socket={socket}
            />
        );
    }

    // DM Chat without partner (group chat)
    if (chatType === 1 && chat.dmPartnerUser.userId === "") {
        return <Avatar size="sm">{chat.chatName[0].toUpperCase()}</Avatar>;
    }

    // GM Chat
    if (chatType === 2) {
        return (
            <GMAvatar
                funcSetAllChats={funcSetAllChats}
                gmChat={chat}
                isYou={isYou}
                myself={myself}
                setCurrentMainChat={setCurrentMainChat}
                setMyself={setMyself}
                UIM={UIM}
                socket={socket}
                TEM={TEM}
            />
        );
    }

    // Project Chat
    if (chatType === 3) {
        return (
            <ProjectAvatar
                funcSetAllChats={funcSetAllChats}
                myself={myself}
                pmChat={chat}
                setCurrentMainChat={setCurrentMainChat}
                setMyself={setMyself}
                UIM={UIM}
                socket={socket}
                TEM={TEM}
            />
        );
    }

    return null;
};
