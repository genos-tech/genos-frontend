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

    // Task-body (5) and task-note (7) surface activities have no chat row of
    // their own — their `chatId` is the project/note id, not a PM channel id —
    // so the `chat` lookup above can't find them. Resolve the project's PM
    // chat by `projectId` instead so these task surfaces render the PROJECT's
    // profile image (a project task / task note belongs to a project), not a
    // generic icon. `projectId` is always set for task body and is set for
    // task notes whose producer forwarded it (task notes without a project
    // gracefully keep the icon fallback below).
    const projectChat = useCM.allChats.find(
        (c) => c.chatType === 3 && c.project?.projectId === activity.projectId
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
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useUISM={useUISM}
                />
            );
        } else {
            return (
                <Avatar size="sm">
                    {((chat?.chatName || activity.chatName || "?")[0] ?? "?").toUpperCase()}
                </Avatar>
            );
        }
    }

    // GM Avatar (chatType === 2)
    if (activity.chatType === 2) {
        if (chat) {
            return (
                <GMAvatar
                    gmChat={chat}
                    isYou={isYou}
                    myself={myself}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
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
                    myself={myself}
                    pmChat={chat}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
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
                    myself={myself}
                    pmChat={chat}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
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
        // Task body mention — the task lives in a project, so show the
        // project's profile image when resolvable; tinted icon otherwise.
        if (projectChat) {
            return (
                <ProjectAvatar
                    myself={myself}
                    pmChat={projectChat}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        }
        return (
            <Avatar size="sm" sx={{ background: "rgba(234, 88, 12, 0.15)", color: "#ea580c" }}>
                <AssignmentRoundedIcon />
            </Avatar>
        );
    }
    if (activity.chatType === 6) {
        // Personal note mention (shared)
        return (
            <Avatar
                size="sm"
                sx={{
                    background: "rgba(var(--gp-brand-700-rgb), 0.15)",
                    color: "var(--gp-brand-700)",
                }}
            >
                <StickyNote2RoundedIcon />
            </Avatar>
        );
    }
    if (activity.chatType === 7) {
        // Task note mention — a task note belongs to a project's task, so
        // show the project's profile image when resolvable; tinted icon
        // otherwise (task notes emitted without a projectId fall back here).
        if (projectChat) {
            return (
                <ProjectAvatar
                    myself={myself}
                    pmChat={projectChat}
                    setMyself={setMyself}
                    socket={socket}
                    useCM={useCM}
                    useTEM={useTEM}
                    useUISM={useUISM}
                />
            );
        }
        return (
            <Avatar size="sm" sx={{ background: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                <NoteAltRoundedIcon />
            </Avatar>
        );
    }
    if (activity.chatType === 8) {
        // Chat note mention — the note belongs to a DM/GM/MDM/PM chat.
        // Use the parent chat's avatar (the same as its corresponding DM,
        // GM, or MDM activity) by looking up via noteChatType + noteChatId.
        const parentChatType = activity.noteChatType;
        const parentChatId = activity.noteChatId != null ? String(activity.noteChatId) : undefined;
        const parentChat =
            parentChatType != null && parentChatId
                ? useCM.allChats.find(
                      (c) => c.chatType === parentChatType && c.chatId === parentChatId
                  )
                : undefined;

        if (parentChatType === 1 || parentChatType === 4) {
            // DM or MDM — use the same avatar logic as the DM/MDM branches above.
            if (parentChatType === 1) {
                const partnerUserId = parentChat?.dmPartnerUser?.userId ?? "";
                if (partnerUserId) {
                    return (
                        <AvatarWithStatus
                            avatarUser={useTEM.teamMemberProfiles[partnerUserId]}
                            isYou={isYou}
                            myself={myself}
                            setMyself={setMyself}
                            socket={socket}
                            useCM={useCM}
                            useUISM={useUISM}
                        />
                    );
                }
            } else {
                // MDM
                if (parentChat) {
                    return (
                        <MDMAvatar
                            members={parentChat.mdmMembers}
                            teamMemberProfiles={useTEM.teamMemberProfiles}
                        />
                    );
                }
            }
        } else if (parentChatType === 2) {
            // GM
            if (parentChat) {
                return (
                    <GMAvatar
                        gmChat={parentChat}
                        isYou={isYou}
                        myself={myself}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                );
            }
        } else if (parentChatType === 3) {
            // PM
            if (parentChat) {
                return (
                    <ProjectAvatar
                        myself={myself}
                        pmChat={parentChat}
                        setMyself={setMyself}
                        socket={socket}
                        useCM={useCM}
                        useTEM={useTEM}
                        useUISM={useUISM}
                    />
                );
            }
        }

        // Fallback: tinted icon when chat data isn't loaded yet.
        return (
            <Avatar size="sm" sx={{ background: "rgba(2, 132, 199, 0.15)", color: "#0284c7" }}>
                <DescriptionRoundedIcon />
            </Avatar>
        );
    }

    return null;
};
