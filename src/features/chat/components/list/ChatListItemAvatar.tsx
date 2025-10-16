import React from "react";
import { Avatar } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../../components/common/ProjectAvatar";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";

interface ChatListItemAvatarProps {
    chat: AllChatProps;
    chatType: number;
    isYou: boolean;
    myself: UserProps;
    setMyself: (value: UserProps) => void;
    setCurrentMainChat: (chat: ChatProps) => void;
    setOpeningService: (value: number) => void;
    socket: Socket | null;
    teamMemberProfiles: Record<string, UserProps>;
    funcSetAllChats: () => Promise<void>;
}

export const ChatListItemAvatar: React.FC<ChatListItemAvatarProps> = ({
    chat,
    chatType,
    isYou,
    myself,
    setMyself,
    setCurrentMainChat,
    setOpeningService,
    socket,
    teamMemberProfiles,
    funcSetAllChats,
}) => {
    // DM Chat with partner
    if (chatType === 1 && chat.dmPartnerUser.userId !== "") {
        return (
            <AvatarWithStatus
                chat={chat}
                isYou={isYou}
                myself={myself}
                setCurrentMainChat={setCurrentMainChat}
                setMyself={setMyself}
                setOpeningService={setOpeningService}
                socket={socket}
                avatarUser={teamMemberProfiles[chat.dmPartnerUser.userId]}
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
                setOpeningService={setOpeningService}
                socket={socket}
                teamMemberProfiles={teamMemberProfiles}
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
                setOpeningService={setOpeningService}
                socket={socket}
                teamMemberProfiles={teamMemberProfiles}
            />
        );
    }

    return null;
};
