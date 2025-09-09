import { Socket } from "socket.io-client";
import React, { useState } from "react";
import { Modal, ModalDialog, Alert, Stack, Button, Typography } from "@mui/joy";

import { UserProps } from "../../../../types/admin";
import { ProjectProps } from "../../../../types/tasks";
import { useAuth } from "../../../../context/AuthContext";

const base_url = import.meta.env.VITE_API_BASE_URL;
const disableOpenJoinModalParams = {
    flag: false,
    projectId: -1,
    projectName: "",
    systemUserId: "",
};

type Props = {
    socket: Socket | null;
    myself: UserProps;
    openJoinProject: {
        flag: boolean;
        projectId: number;
        projectName: string;
        systemUserId: string;
    };
    setOpenJoinProject: (value: {
        flag: boolean;
        projectId: number;
        projectName: string;
        systemUserId: string;
    }) => void;
};
export const ModalJoinProject: React.FC<Props> = ({
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
                                        text: "Sent a request to join the project: ",
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
                sx={{ zIndex: 10010 }}
                open={openJoinProject.flag}
                onClose={() => setOpenJoinProject(disableOpenJoinModalParams)}
            >
                <ModalDialog>
                    <Typography level="h4">
                        Sending a request to join{" "}
                        <Typography level="h3" color="primary">
                            {openJoinProject.projectName}
                        </Typography>
                    </Typography>
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            component="button"
                            color="danger"
                            variant="outlined"
                            onClick={() => setOpenJoinProject(disableOpenJoinModalParams)}
                        >
                            Cancel
                        </Button>
                        <Button
                            component="button"
                            variant="soft"
                            color="primary"
                            onClick={handleJoinProject}
                        >
                            Send
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
