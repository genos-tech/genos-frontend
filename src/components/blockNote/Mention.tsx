import { useState } from "react";
import { createReactInlineContentSpec, DefaultReactSuggestionItem } from "@blocknote/react";
import { Avatar, Box, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { UserProfile } from "../../features/admin/components/modals/ModalUserProfile";
import { UserProps } from "../../types/admin";
import { ChatProps } from "../../types/chat";
import { PulseDot } from "../utils/PulseDot";

const media_url = import.meta.env.VITE_MEDIA_ROOT_DJANGO;

// The Mention inline content
export const CreateMentionSpec = (
    teamMemberProfiles: Record<string, UserProps>,
    socket: Socket | null,
    myself: UserProps,
    setMyself: (value: UserProps) => void,
    setOpeningService: (service: number) => void,
    setCurrentMainChat: (chat: ChatProps) => void
) =>
    createReactInlineContentSpec(
        {
            type: "mention",
            propSchema: {
                userName: {
                    default: "N/A",
                },
                userId: {
                    default: "N/A",
                },
            },
            content: "none",
        },
        {
            render: (props) => {
                const userName = props.inlineContent.props.userName;
                const userId = props.inlineContent.props.userId;

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
                                        ? "#ddff003e"
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
                                    color: myself.userId === userId ? "#ff7700ff" : "#ff0077fd",
                                }}
                            >
                                @{userName}
                            </Typography>
                        </Box>

                        <UserProfile
                            socket={socket}
                            myself={myself}
                            setMyself={setMyself}
                            isYou={myself.userId === userId ? true : false}
                            user={teamMemberProfiles[userId]}
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
    teamMemberProfiles: Record<string, UserProps>,
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
                        src={`${media_url}/${user.avatarImgPath}`}
                        alt={user.userName}
                        sx={{ width: 32, height: 32 }}
                    />
                    <Box position="absolute" bottom={0} right={0} width={10} height={10}>
                        <PulseDot
                            color={
                                teamMemberProfiles[user.userId]?.isOnline === true &&
                                teamMemberProfiles[user.userId]?.isOfflineForced !== "true"
                                    ? "#4caf50"
                                    : "#999"
                            }
                        />
                    </Box>
                </Box>
                {user.userName}
            </Box>
        ),
    }));
};
