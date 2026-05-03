import React from "react";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import GroupsIcon from "@mui/icons-material/Groups";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import { Avatar } from "@mui/joy";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../../components/ui/avatars/GMAvatar";
import { MDMAvatar } from "../../../../../components/ui/avatars/MDMAvatar";
import { ProjectAvatar } from "../../../../../components/ui/avatars/ProjectAvatar";
import { ChatManagementState } from "../../../../../hooks/chats/useChatManagement";
import { TeamManagementState } from "../../../../../hooks/common/useTeamManagement";
import { UIStateManagementState } from "../../../../../hooks/common/useUIStateManagement";
import { UserProps } from "../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../types/chat";

interface ActivityAvatarProps {
    activity: ActivityMessageProps;
    myself: UserProps;
    useTEM: TeamManagementState;
    socket: Socket | null;
    setMyself: (value: UserProps) => void;
    useUISM: UIStateManagementState;
    useCM: ChatManagementState;
    isYou: boolean;
}

export const ActivityAvatar: React.FC<ActivityAvatarProps> = ({
    useTEM,
    activity,
    myself,
    socket,
    setMyself,
    useUISM,
    useCM,
    isYou,
}) => {
    // chat_type=4 is dual-purpose:
    //   - task-comment activities (activity.taskId truthy) belong to a PM
    //     chat (chat_type=3), and `activity.chatId` is the project_id.
    //   - MDM activities (no taskId) belong to an MDM chat (chat_type=4),
    //     and `activity.chatId` is the mdm_id.
    const isTaskComment = activity.chatType === 4 && !!activity.taskId;
    const isMDM = activity.chatType === 4 && !activity.taskId;
    const lookupChatType = isTaskComment ? 3 : activity.chatType;
    const chat = useCM.allChats.find(
        (chat) => chat.chatType === lookupChatType && chat.chatId === activity.chatId
    );

    // DM Avatar (chatType === 1)
    if (activity.chatType === 1) {
        if (activity.dmPartnerUserId !== "") {
            return (
                <AvatarWithStatus
                    avatarUser={useTEM.teamMemberProfiles[activity.dmPartnerUserId]}
                    useCM={useCM}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useUISM={useUISM}
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
                    useCM={useCM}
                    gmChat={chat}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
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
                    useCM={useCM}
                    myself={myself}
                    pmChat={chat}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
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

    // Task-comment avatar (chatType === 4 with taskId): borrow the PM avatar
    // because task comments live inside a project.
    if (isTaskComment) {
        if (chat) {
            return (
                <ProjectAvatar
                    useCM={useCM}
                    myself={myself}
                    pmChat={chat}
                    setMyself={setMyself}
                    socket={socket}
                    useTEM={useTEM}
                    useUISM={useUISM}
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

    // MDM Avatar (chatType === 4 without taskId): show the overlapping member
    // avatars to match how MDM chats render in the sidebar list.
    if (isMDM) {
        if (chat) {
            return (
                <MDMAvatar
                    members={chat.mdmMembers}
                    teamMemberProfiles={useTEM.teamMemberProfiles}
                />
            );
        } else {
            return (
                <Avatar size="sm">
                    <PeopleRoundedIcon />
                </Avatar>
            );
        }
    }

    return null;
};
