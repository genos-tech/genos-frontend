import React from "react";
import AssignmentIcon from "@mui/icons-material/Assignment";
import AssignmentRoundedIcon from "@mui/icons-material/AssignmentRounded";
import DescriptionRoundedIcon from "@mui/icons-material/DescriptionRounded";
import GroupsIcon from "@mui/icons-material/Groups";
import NoteAltRoundedIcon from "@mui/icons-material/NoteAltRounded";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import StickyNote2RoundedIcon from "@mui/icons-material/StickyNote2Rounded";
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
    // PUNCH LIST (v3 chatId migration): `AllChatProps.chatId` is `string`
    // post-flip; `ActivityMessageProps.chatId` is still `number` (legacy
    // activity payload). Stringify at the comparison.
    const chat = useCM.allChats.find(
        (chat) => chat.chatType === lookupChatType && chat.chatId === String(activity.chatId)
    );

    // DM Avatar (chatType === 1).
    // `activity.dmPartnerUserId` is sender-centric (it's the sender's
    // userId, set on the backend at the moment the message is emitted),
    // so for the SENDER receiving their own activity it points at
    // themselves and the avatar would render wrong. Prefer the server-
    // resolved partner from the per-user allChats record; fall back to
    // the activity payload only when allChats hasn't synced yet.
    if (activity.chatType === 1) {
        const partnerUserId = chat?.dmPartnerUser?.userId || activity.dmPartnerUserId;
        if (partnerUserId !== "") {
            return (
                <AvatarWithStatus
                    avatarUser={useTEM.teamMemberProfiles[partnerUserId]}
                    useCM={useCM}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useUISM={useUISM}
                />
            );
        } else {
            return (
                <Avatar size="sm">{(chat?.chatName ?? activity.chatName)[0].toUpperCase()}</Avatar>
            );
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
                    <AssignmentIcon />
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

    // Non-chat mention surfaces — each gets its own tinted icon avatar so
    // the user can tell at a glance which surface produced the notification.
    // Colors mirror SURFACE_CHIP_COLOR in ActivityTypeChips.
    if (activity.chatType === 5) {
        // Task body mention
        return (
            <Avatar size="sm" sx={{ background: "rgba(234, 88, 12, 0.15)", color: "#ea580c" }}>
                <AssignmentRoundedIcon />
            </Avatar>
        );
    }
    if (activity.chatType === 6) {
        // Personal note mention (shared)
        return (
            <Avatar size="sm" sx={{ background: "rgba(124, 58, 237, 0.15)", color: "#7c3aed" }}>
                <StickyNote2RoundedIcon />
            </Avatar>
        );
    }
    if (activity.chatType === 7) {
        // Task note mention
        return (
            <Avatar size="sm" sx={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <NoteAltRoundedIcon />
            </Avatar>
        );
    }
    if (activity.chatType === 8) {
        // Chat note mention
        return (
            <Avatar size="sm" sx={{ background: "rgba(2, 132, 199, 0.15)", color: "#0284c7" }}>
                <DescriptionRoundedIcon />
            </Avatar>
        );
    }

    return null;
};
