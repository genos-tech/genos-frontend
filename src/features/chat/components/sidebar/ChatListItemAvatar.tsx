import React from "react";
import PeopleRoundedIcon from "@mui/icons-material/PeopleRounded";
import { Avatar, Box } from "@mui/joy";
import { useColorScheme } from "@mui/joy/styles";
import { Socket } from "socket.io-client";

import { AvatarWithStatus } from "../../../../components/ui/avatars/avatarWithStatus";
import { GMAvatar } from "../../../../components/ui/avatars/GMAvatar";
import { ProjectAvatar } from "../../../../components/ui/avatars/ProjectAvatar";
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
    useUISM: UIStateManagementState;
    socket: Socket | null;
    useTEM: TeamManagementState;
    useCM: ChatManagementState;
}

export const ChatListItemAvatar: React.FC<ChatListItemAvatarProps> = ({
    useTEM,
    chat,
    chatType,
    isYou,
    myself,
    setMyself,
    useUISM,
    socket,
    useCM,
}) => {
    const { mode } = useColorScheme();
    const isDark = mode === "dark";

    // DM Chat with partner
    if (chatType === 1 && chat.dmPartnerUser.userId !== "") {
        return (
            <AvatarWithStatus
                avatarUser={useTEM.teamMemberProfiles[chat.dmPartnerUser.userId]}
                chat={chat}
                useCM={useCM}
                isYou={isYou}
                myself={myself}
                setMyself={setMyself}
                socket={socket}
                useUISM={useUISM}
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
    }

    // Project Chat
    if (chatType === 3) {
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
    }

    // MDM (Multi-user DM) Chat - show group-style avatar with icon
    if (chatType === 4) {
        return (
            <Box sx={{ position: "relative" }}>
                <Avatar
                    size="sm"
                    sx={{
                        background: isDark
                            ? "linear-gradient(135deg, rgba(59, 130, 246, 0.3) 0%, rgba(37, 99, 235, 0.3) 100%)"
                            : "linear-gradient(135deg, rgba(59, 130, 246, 0.2) 0%, rgba(37, 99, 235, 0.2) 100%)",
                        border: "1px solid",
                        borderColor: isDark
                            ? "rgba(59, 130, 246, 0.4)"
                            : "rgba(59, 130, 246, 0.3)",
                    }}
                >
                    <PeopleRoundedIcon
                        sx={{
                            fontSize: 18,
                            color: isDark ? "#60a5fa" : "#3b82f6",
                        }}
                    />
                </Avatar>
            </Box>
        );
    }

    return null;
};
