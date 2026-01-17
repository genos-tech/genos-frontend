import React, { useState } from "react";
import { keyframes } from "@emotion/react";
import FolderSharedIcon from "@mui/icons-material/FolderShared";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import PublicIcon from "@mui/icons-material/Public";
import SendIcon from "@mui/icons-material/Send";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { loadSpecificPM } from "../../../../features/chat/services/loadSpecificPM";
import { ChatManagementState } from "../../../../hooks/chats/useChatManagement";
import { ProjectManagementState } from "../../../../hooks/common/useProjectManagement";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { ProjectProps } from "../../../../types/tasks";
import { addChat } from "../../../chat/services/addChat";
import { addMessage } from "../../../chat/services/addMessage";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

const base_url = import.meta.env.VITE_API_BASE_URL;
const disableOpenJoinModalParams = {
    flag: false,
    projectId: -1,
    projectName: "",
    isPrivate: true,
    systemUserId: "",
};

type Props = {
    socket: Socket | null;
    myself: UserProps;
    openJoinProject: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    };
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        isPrivate: boolean;
        systemUserId: string;
    }) => void;
    usePM: ProjectManagementState;
    useCM: ChatManagementState;
};
export const ModalJoinProject: React.FC<Props> = ({
    useCM,
    usePM,
    socket,
    myself,
    openJoinProject,
    setOpenJoinProject,
}) => {
    const { accessToken } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function joinProject(): Promise<void> {
        try {
            if (socket !== null) {
                if (openJoinProject.isPrivate === true) {
                    socket.emit(
                        "join_project_request",
                        {
                            joiningProjectId: openJoinProject.projectId,
                            joiningProjectName: openJoinProject.projectName,
                        },
                        async (ack: any) => {
                            const item_body = [
                                {
                                    type: "paragraph",
                                    props: {
                                        textColor: "default",
                                        textAlignment: "left",
                                        backgroundColor: "default",
                                    },
                                    content: [
                                        {
                                            text: "Has sent a request to join the project: ",
                                            type: "text",
                                            styles: {},
                                        },
                                        {
                                            text: openJoinProject.projectName,
                                            type: "text",
                                            styles: { bold: true, textColor: "pink" },
                                        },
                                        {
                                            text: ".",
                                            type: "text",
                                            styles: {},
                                        },
                                    ],
                                    children: [],
                                },
                                {
                                    type: "paragraph",
                                    props: {
                                        textColor: "default",
                                        textAlignment: "left",
                                        backgroundColor: "default",
                                    },
                                    content: [],
                                    children: [],
                                },
                            ];

                            const sendInboxMessageResponse = await fetch(`${base_url}/inbox/`, {
                                method: "POST",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${accessToken}`,
                                },
                                body: JSON.stringify({
                                    team_id: myself.teamId,
                                    sender_id: myself.userId,
                                    receiver_id: myself.userId,
                                    item_body: item_body,
                                    item_type: 0,
                                }),
                            });
                            if (!sendInboxMessageResponse.ok) {
                                throw new Error("Failed to send a inbox message");
                            }
                        }
                    );
                } else {
                    const joinProjectResponse = await fetch(`${base_url}/project/join/`, {
                        method: "POST",
                        headers: {
                            "Content-Type": "application/json",
                            Authorization: `Bearer ${accessToken}`,
                        },
                        body: JSON.stringify({
                            team_id: myself.teamId,
                            project_id: openJoinProject.projectId,
                            attendee_id: myself.userId,
                        }),
                    });

                    const joinProjectData = await joinProjectResponse.json();

                    if (!joinProjectResponse.ok) {
                        console.error(joinProjectData);
                        throw new Error(
                            joinProjectData.hint || "Failed to join the created project"
                        );
                    } else {
                        if (openJoinProject.projectId) {
                            usePM.setCurrentProject({
                                projectId: openJoinProject.projectId,
                                projectName: openJoinProject.projectName,
                                isPrivate: openJoinProject.isPrivate,
                                projectTags: [],
                                systemUserId: openJoinProject.systemUserId,
                            });
                            (async () => {
                                const loadedChat: ChatProps[] = await loadSpecificPM(
                                    myself.teamId,
                                    myself.teamName,
                                    myself.userId,
                                    openJoinProject.projectId,
                                    accessToken
                                );
                                if (loadedChat) {
                                    const sortedMessages = loadedChat[0].messages.sort(
                                        (a, b) => a.messageId - b.messageId
                                    );
                                    const newChat: AllChatProps = {
                                        chatType: 3,
                                        chatId: loadedChat[0].chatId,
                                        chatName: loadedChat[0].chatName,
                                        lastReadMessageId: loadedChat[0].lastReadMessageId,
                                        dmPartnerUser: loadedChat[0].dmPartnerUser,
                                        latestMessage: loadedChat[0].latestMessage,
                                        latestMessageText: loadedChat[0].latestMessageText,
                                        TSLastMessage: loadedChat[0].TSLastMessage,
                                        isPrivate: loadedChat[0].isPrivate,
                                        profileImagePath: loadedChat[0].profileImagePath,
                                        isPinned: loadedChat[0].isPinned,
                                        tsLastAllReadActivity: loadedChat[0].tsLastAllReadActivity,
                                    };
                                    await addChat(newChat, newChat.chatType);
                                    await addMessage(newChat.latestMessage, newChat.chatType);

                                    useCM.setAllChats([newChat, ...useCM.allChats]);
                                }
                            })();
                        } else {
                            console.error("Failed to join the project");
                        }
                    }
                }
                setOpenJoinProject(disableOpenJoinModalParams);
            } else {
                const err_msg: string = "Socket not found.";
                console.error(err_msg);
                setErrorMessage(err_msg);
                throw new Error(err_msg);
            }
        } catch (error) {
            const err_msg = `${error}`;
            console.error(err_msg);
            setErrorMessage(err_msg);
        }
    }

    const handleJoinProject = () => {
        joinProject();
    };

    return (
        <Modal
            open={openJoinProject.flag}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={() => setOpenJoinProject(disableOpenJoinModalParams)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: `1px solid ${openJoinProject.isPrivate ? "rgba(168, 85, 247, 0.2)" : "rgba(59, 130, 246, 0.2)"}`,
                    borderRadius: "16px",
                    boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px ${openJoinProject.isPrivate ? "rgba(168, 85, 247, 0.1)" : "rgba(59, 130, 246, 0.1)"}`,
                    minWidth: "360px",
                    p: 3,
                    textAlign: "center",
                }}
            >
                {/* Icon */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: 56,
                        height: 56,
                        borderRadius: "14px",
                        background: openJoinProject.isPrivate
                            ? "linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)"
                            : "linear-gradient(135deg, rgba(59, 130, 246, 0.15) 0%, rgba(99, 102, 241, 0.15) 100%)",
                        border: `1px solid ${openJoinProject.isPrivate ? "rgba(168, 85, 247, 0.25)" : "rgba(59, 130, 246, 0.25)"}`,
                        mx: "auto",
                        mb: 2,
                    }}
                >
                    <FolderSharedIcon
                        sx={{
                            color: openJoinProject.isPrivate
                                ? "rgba(168, 85, 247, 0.9)"
                                : "rgba(59, 130, 246, 0.9)",
                            fontSize: 28,
                        }}
                    />
                </Box>

                {/* Privacy Badge */}
                <Box
                    sx={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: 1,
                        mb: 1,
                    }}
                >
                    {openJoinProject.isPrivate ? (
                        <>
                            <LockOutlineIcon
                                sx={{ color: "rgba(168, 85, 247, 0.7)", fontSize: 16 }}
                            />
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: "rgba(168, 85, 247, 0.8)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                }}
                            >
                                Private Project
                            </Typography>
                        </>
                    ) : (
                        <>
                            <PublicIcon sx={{ color: "rgba(59, 130, 246, 0.7)", fontSize: 16 }} />
                            <Typography
                                level="body-xs"
                                sx={{
                                    color: "rgba(59, 130, 246, 0.8)",
                                    textTransform: "uppercase",
                                    letterSpacing: "0.1em",
                                }}
                            >
                                Public Project
                            </Typography>
                        </>
                    )}
                </Box>

                {/* Title */}
                <Typography
                    level="h4"
                    sx={{
                        color: "rgba(255, 255, 255, 0.9)",
                        fontWeight: 600,
                        mb: 0.5,
                    }}
                >
                    {openJoinProject.isPrivate ? "Request to Join" : "Join Project"}
                </Typography>

                {/* Project Name */}
                <Typography
                    level="h3"
                    sx={{
                        background: openJoinProject.isPrivate
                            ? "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)"
                            : "linear-gradient(135deg, #60a5fa 0%, #3b82f6 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontWeight: 700,
                        mb: 2.5,
                    }}
                >
                    {openJoinProject.projectName}
                </Typography>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                            textAlign: "left",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
                    <Button
                        variant="plain"
                        onClick={() => setOpenJoinProject(disableOpenJoinModalParams)}
                        sx={{
                            color: "rgba(255, 255, 255, 0.6)",
                            borderRadius: "10px",
                            px: 3,
                            "&:hover": {
                                backgroundColor: "rgba(255, 255, 255, 0.05)",
                                color: "rgba(255, 255, 255, 0.9)",
                            },
                        }}
                    >
                        Cancel
                    </Button>
                    <Button
                        onClick={handleJoinProject}
                        endDecorator={
                            openJoinProject.isPrivate ? (
                                <SendIcon sx={{ fontSize: 16 }} />
                            ) : undefined
                        }
                        sx={{
                            background: openJoinProject.isPrivate
                                ? "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)"
                                : "linear-gradient(135deg, #3b82f6 0%, #6366f1 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: openJoinProject.isPrivate
                                ? "0 4px 15px rgba(168, 85, 247, 0.3)"
                                : "0 4px 15px rgba(59, 130, 246, 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: openJoinProject.isPrivate
                                    ? "0 6px 20px rgba(168, 85, 247, 0.4)"
                                    : "0 6px 20px rgba(59, 130, 246, 0.4)",
                            },
                        }}
                    >
                        {openJoinProject.isPrivate ? "Send Request" : "Join Project"}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
