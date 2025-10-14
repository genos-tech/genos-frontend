import LockOutlineIcon from "@mui/icons-material/LockOutline";
import { Alert, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import React, { useState } from "react";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { UserProps } from "../../../../types/admin";

const base_url = import.meta.env.VITE_API_BASE_URL;
const disableOpenJoinGMParams = {
    flag: false,
    chatId: -1,
    chatName: "",
};

type Props = {
    socket: Socket | null;
    myself: UserProps;
    openJoinGM: {
        flag: boolean;
        chatId: number;
        chatName: string;
    };
    setOpenJoinGM: (value: { flag: boolean; chatId: number; chatName: string }) => void;
};
export const ModalJoinGM: React.FC<Props> = ({ socket, myself, openJoinGM, setOpenJoinGM }) => {
    const { accessToken } = useAuth();
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    async function joinGM(): Promise<void> {
        try {
            if (socket !== null) {
                console.log("joinGM");
                socket.emit(
                    "join_gm_request",
                    {
                        joiningGMId: openJoinGM.chatId,
                        joiningGMName: openJoinGM.chatName,
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
                                        text: "Has sent a request to join the Group: ",
                                        type: "text",
                                        styles: {},
                                    },
                                    {
                                        text: openJoinGM.chatName,
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
                setOpenJoinGM(disableOpenJoinGMParams);
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

    const handleJoinGM = () => {
        joinGM();
    };

    return (
        <>
            <Modal
                open={openJoinGM.flag}
                sx={{ zIndex: 10010 }}
                onClose={() => setOpenJoinGM(disableOpenJoinGMParams)}
            >
                <ModalDialog>
                    <Typography
                        level="h4"
                        startDecorator={<LockOutlineIcon sx={{ fontSize: "22px" }} />}
                    >
                        Make a request to join GM -
                        <Typography color="primary" level="h3" sx={{ ml: 1 }}>
                            {openJoinGM.chatName}
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
                            onClick={() => setOpenJoinGM(disableOpenJoinGMParams)}
                        >
                            Cancel
                        </Button>
                        <Button
                            color="primary"
                            component="button"
                            variant="soft"
                            onClick={handleJoinGM}
                        >
                            Send
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
