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
                user: {
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
                const user = props.inlineContent.props.user;
                const online = props.inlineContent.props.online;
                const [openUserProfile, setOpenUserProfile] = useState<boolean>(false);
                return (
                    <>
                        <Box
                            onClick={() => setOpenUserProfile(true)}
                            sx={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 0.5,
                                backgroundColor: "#fffb0033",
                                borderRadius: "12px",
                                px: 1,
                                py: 0.5,
                                cursor: "pointer",
                                userSelect: "none",
                                fontSize: "0.875rem",
                            }}
                        >
                            <Typography level="body-sm" fontWeight={"bold"} color="primary">
                                @{user}
                            </Typography>
                            <PulseDot color={online ? "#4caf50" : "#999"} />
                        </Box>

                        <UserProfile
                            socket={socket}
                            userProfile={myself}
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
    return users.map((user) => ({
        title: user.userName,
        subtext: user.userEmail,
        badge: user.customStatus,
        onItemClick: () => {
            editor.insertInlineContent([
                {
                    type: "mention",
                    props: {
                        user: user.userName,
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
            </Box>
        ),
    }));
};
