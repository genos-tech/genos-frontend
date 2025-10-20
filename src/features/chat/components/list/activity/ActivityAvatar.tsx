import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import GroupsIcon from "@mui/icons-material/Groups";
import { Avatar } from "@mui/joy";
import React from "react";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../../../components/common/ProjectAvatar";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps, AllChatProps } from "../../../../../types/chat";

interface ActivityAvatarProps {
    activity: ActivityMessageProps;
    myself: UserProps;
    teamMemberProfiles: Record<string, UserProps>;
    socket: Socket | null;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: any) => void;
    setMyself: (value: UserProps) => void;
    setOpeningService: (value: number) => void;
    funcSetAllChats: () => Promise<void>;
    isYou: boolean;
}

export const ActivityAvatar: React.FC<ActivityAvatarProps> = ({
    activity,
    myself,
    teamMemberProfiles,
    socket,
    allChats,
    setCurrentMainChat,
    setMyself,
    setOpeningService,
    funcSetAllChats,
    isYou,
}) => {
    const chat = allChats.find(
        (chat) => chat.chatType === activity.chatType && chat.chatId === activity.chatId
    );

    // DM Avatar (chatType === 1)
    if (activity.chatType === 1) {
        if (activity.dmPartnerUserId !== "") {
            return (
                <AvatarWithStatus
                    avatarUser={teamMemberProfiles[activity.dmPartnerUserId]}
                    isYou={isYou}
                    myself={myself}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    setOpeningService={setOpeningService}
                    socket={socket}
                />
            );
        } else {
            return <Avatar size="sm">{activity.chatName[0].toUpperCase()}</Avatar>;
        }
    }

    // GM Avatar (chatType === 2)
    if (activity.chatType === 2) {
        if (chat) {
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
        } else {
            return (
                <Avatar size="sm">
                    <GroupsIcon />
                </Avatar>
            );
        }
    }

    // PM Avatar (chatType === 3)
    if (activity.chatType === 3) {
        if (chat) {
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
        } else {
            return (
                <Avatar size="sm">
                    <AccountTreeIcon />
                </Avatar>
            );
        }
    }

    // Task Avatar (chatType === 4)
    if (activity.chatType === 4) {
        return (
            <Avatar size="sm">
                <AssignmentRoundedIcon />
            </Avatar>
        );
    }

    return null;
};
