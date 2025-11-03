import { Avatar } from "@mui/joy";
import React from "react";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps } from "../../../../types/chat";

interface ChatListItemAvatarProps {
    chat: AllChatProps;
    chatType: number;
    isYou: boolean;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    UIM: UIStateManagementState;
    socket: Socket | null;
    TEM: TeamManagementState;
    CM: ChatManagementState;
}

export const ChatListItemAvatar: React.FC<ChatListItemAvatarProps> = ({
    TEM,
    chat,
    chatType,
    isYou,
    myself,
    setMyself,
    UIM,
    socket,
    CM,
}) => {
    // DM Chat with partner
    if (chatType === 1 && chat.dmPartnerUser.userId !== "") {
        return (
            <AvatarWithStatus
                avatarUser={TEM.teamMemberProfiles[chat.dmPartnerUser.userId]}
                chat={chat}
                CM={CM}
                isYou={isYou}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                UIM={UIM}
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
                CM={CM}
                gmChat={chat}
                isYou={isYou}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                TEM={TEM}
                UIM={UIM}
            />
        );
    }

    // Project Chat
    if (chatType === 3) {
        return (
            <ProjectAvatar
                CM={CM}
                myself={myself}
                pmChat={chat}
                setMyself={setMyself}
                socket={socket}
                TEM={TEM}
                UIM={UIM}
            />
        );
    }

    return null;
};
