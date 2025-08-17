import { useState } from "react";
import { createReactInlineContentSpec, DefaultReactSuggestionItem } from "@blocknote/react";
import { Box, Typography, Avatar } from "@mui/joy";
import { Socket } from "socket.io-client";

import { PulseDot } from "../utils/PulseDot";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { UserProfile } from "../../features/admin/components/modals/UserProfile";

// The Mention inline content
export const CreateMentionSpec = (
    socket: Socket | null,
    myself: UserProps,
    setOpeningService: (service: number) => void,
    setCurrentMainChat: (chat: ChatProps) => void
) =>
    createReactInlineContentSpec(
        {
            type: "mention",
            propSchema: {
                userName: {
                    default: "Unknown",
                },
                userEmail: {
                    default: "Unknown",
                },
                userId: {
                    default: "Unknown",
                },
                teamId: {
                    default: "Unknown",
                },
                teamName: {
                    default: "Unknown",
                },
                avatarImgPath: {
                    default: "Unknown",
                },
                customStatus: {
                    default: "Unknown",
                },
                online: {
                    default: false,
                },
            },
            content: "none",
        },
        {
            render: (props) => {
                const userName = props.inlineContent.props.userName;
                const userEmail = props.inlineContent.props.userEmail;
                const userId = props.inlineContent.props.userId;
                const teamId = props.inlineContent.props.teamId;
                const teamName = props.inlineContent.props.teamName;
                const avatarImgPath = props.inlineContent.props.avatarImgPath;
                const customStatus = props.inlineContent.props.customStatus;
                const online = props.inlineContent.props.online;

                const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);

                return (
                    <>
                        <Box
                            onClick={() => {
                                setOpenUserProfile(true);
                            }}
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                backgroundColor:
                                    myself.userId === userId
                                        ? "#ff77006c"
                                        : "rgba(255, 0, 238, 0.15)",
                                borderRadius: "12px",
                                px: 1,
                                py: 0.5,
                                cursor: "pointer",
                                userSelect: "none",
                                fontSize: "0.875rem",
                            }}
                        >
                            <Typography
                                level="body-sm"
                                fontWeight={"bold"}
                                sx={{
                                    color: myself.userId === userId ? "#9a4800ff" : "#ff00a6fd",
                                }}
                            >
                                @{userName}
                            </Typography>
                            <PulseDot color={online ? "#4caf50" : "#999"} />
                        </Box>

                        <UserProfile
                            socket={socket}
                            userProfile={{
                                userName: userName,
                                userEmail: userEmail,
                                userId: userId,
                                teamId: teamId,
                                teamName: teamName,
                                avatarImgPath: avatarImgPath,
                                customStatus: customStatus,
                                online: online,
                            }}
                            openUserProfile={openUserProfile}
                            setOpenUserProfile={setOpenUserProfile}
                            setCurrentMainChat={setCurrentMainChat}
                            setOpeningService={setOpeningService}
                        />
                    </>
                );
            },
        }
    );

// Function which gets all users for the mentions menu.
export const MentionMenuItems = (
    editor: any,
    users: UserProps[]
): DefaultReactSuggestionItem[] => {
    return users.map((user, index) => ({
        title: user.userEmail,
        badge: user.customStatus,
        onItemClick: () => {
            editor.insertInlineContent([
                {
                    key: user.userId,
                    type: "mention",
                    props: {
                        userName: user.userName,
                        userEmail: user.userEmail,
                        userId: user.userId,
                        teamId: user.teamId,
                        teamName: user.teamName,
                        avatarImgPath: user.avatarImgPath,
                        customStatus: user.customStatus,
                        online: user.online,
                    },
                },
                " ",
            ]);
        },
        icon: (
            <Box display="flex" alignItems="center" gap={1}>
                {/* Avatar + Status Dot */}
                <Box position="relative" width={32} height={32}>
                    <Avatar
                        src={user.avatarImgPath}
                        alt={user.userName}
                        sx={{ width: 32, height: 32 }}
                    />
                    <Box position="absolute" bottom={0} right={0} width={10} height={10}>
                        <PulseDot color={user.online ? "#4caf50" : "#9e9e9e"} />
                    </Box>
                </Box>
                {user.userName}
            </Box>
        ),
    }));
};
