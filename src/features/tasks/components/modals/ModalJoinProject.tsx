import React, { useState } from "react";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { loadSpecificPM } from "../../../../features/chat/services/loadSpecificPM";
import { UserProps } from "../../../../types/admin";
import { AllChatProps, ChatProps } from "../../../../types/chat";
import { ProjectProps } from "../../../../types/tasks";
import { addChat } from "../../../chat/services/addChat";
import { addMessage } from "../../../chat/services/addMessage";

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
    setCurrentProject: (value: ProjectProps) => void;
    loadProjectsAndTasks: (value: number) => Promise<void>;
    allChats: AllChatProps[];
    setAllChats: (value: AllChatProps[]) => void;
};
export const ModalJoinProject: React.FC<Props> = ({
    socket,
    myself,
    openJoinProject,
    setOpenJoinProject,
    setCurrentProject,
    loadProjectsAndTasks,
    allChats,
    setAllChats,
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
                            setCurrentProject({
                                projectId: openJoinProject.projectId,
                                projectName: openJoinProject.projectName,
                                isPrivate: openJoinProject.isPrivate,
                                projectTags: [],
                                systemUserId: openJoinProject.systemUserId,
                            });
                            (async () => {
                                await loadProjectsAndTasks(openJoinProject.projectId);
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

                                    setAllChats([newChat, ...allChats]);
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
        <>
            <Modal
                open={openJoinProject.flag}
                sx={{ zIndex: 10010 }}
                onClose={() => setOpenJoinProject(disableOpenJoinModalParams)}
            >
                <ModalDialog>
                    <Typography
                        level="h4"
                        startDecorator={
                            openJoinProject.isPrivate === true ? (
                                <LockOutlineIcon sx={{ fontSize: "22px" }} />
                            ) : undefined
                        }
                    >
                        {openJoinProject.isPrivate === true
                            ? "Make a Request to Join -"
                            : "Join the Project -"}
                        <Typography color="primary" level="h3" sx={{ ml: 1 }}>
                            {openJoinProject.projectName}
                        </Typography>
                    </Typography>

                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}

                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            color="danger"
                            component="button"
                            variant="outlined"
                            onClick={() => setOpenJoinProject(disableOpenJoinModalParams)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            component="button"
                            variant="soft"
                            onClick={handleJoinProject}
                        >
                            {openJoinProject.isPrivate === true ? "Send" : "Join"}
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
