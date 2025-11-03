import React from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import GroupsIcon from "@mui/icons-material/Groups";
import { Avatar } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/common/avatarWithStatus";
import { GMAvatar } from "../../../../../components/common/GMAvatar";
import { ProjectAvatar } from "../../../../../components/common/ProjectAvatar";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps, AllChatProps } from "../../../../../types/chat";

interface ActivityAvatarProps {
    activity: ActivityMessageProps;
    myself: UserProps;
    TEM: TeamManagementState;
    socket: Socket | null;
    allChats: AllChatProps[];
    setCurrentMainChat: (chat: any) => void;
    setMyself: (value: UserProps) => void;
    UIM: UIStateManagementState;
    funcSetAllChats: () => Promise<void>;
    isYou: boolean;
}

export const ActivityAvatar: React.FC<ActivityAvatarProps> = ({
    TEM,
    activity,
    myself,
    socket,
    allChats,
    setCurrentMainChat,
    setMyself,
    UIM,
    funcSetAllChats,
    isYou,
}) => {
    const chat = allChats.find(
        (chat) =>
            chat.chatType === (activity.chatType === 4 ? 3 : activity.chatType) &&
            chat.chatId === activity.chatId
    );

    // DM Avatar (chatType === 1)
    if (activity.chatType === 1) {
        if (activity.dmPartnerUserId !== "") {
            return (
                <AvatarWithStatus
                    avatarUser={TEM.teamMemberProfiles[activity.dmPartnerUserId]}
                    isYou={isYou}
                    myself={myself}
                    setCurrentMainChat={setCurrentMainChat}
                    setMyself={setMyself}
                    UIM={UIM}
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
                    UIM={UIM}
                    socket={socket}
                    TEM={TEM}
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
                    UIM={UIM}
                    socket={socket}
                    TEM={TEM}
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
        if (chat) {
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
        } else {
            return (
                <Avatar size="sm">
                    <AssignmentRoundedIcon />
                </Avatar>
            );
        }
    }

    return null;
};
