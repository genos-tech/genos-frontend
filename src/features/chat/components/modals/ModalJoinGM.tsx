import React, { useState } from "react";
import GroupsIcon from "@mui/icons-material/Groups";
import LockOutlineIcon from "@mui/icons-material/LockOutline";
import SendIcon from "@mui/icons-material/Send";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { keyframes } from "@emotion/react";
import { Socket } from "socket.io-client";

import { useAuth } from "../../../../context/AuthContext";
import { UserProps } from "../../../../types/admin";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

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
        <Modal
            open={openJoinGM.flag}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={() => setOpenJoinGM(disableOpenJoinGMParams)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(168, 85, 247, 0.2)",
                    borderRadius: "16px",
                    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(168, 85, 247, 0.1)",
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
                        background: "linear-gradient(135deg, rgba(168, 85, 247, 0.15) 0%, rgba(139, 92, 246, 0.15) 100%)",
                        border: "1px solid rgba(168, 85, 247, 0.25)",
                        mx: "auto",
                        mb: 2,
                    }}
                >
                    <GroupsIcon sx={{ color: "rgba(168, 85, 247, 0.9)", fontSize: 28 }} />
                </Box>

                {/* Title */}
                <Box sx={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 1, mb: 1 }}>
                    <LockOutlineIcon sx={{ color: "rgba(168, 85, 247, 0.7)", fontSize: 18 }} />
                    <Typography
                        level="body-sm"
                        sx={{ color: "rgba(255, 255, 255, 0.5)", textTransform: "uppercase", letterSpacing: "0.1em" }}
                    >
                        Private Group
                    </Typography>
                </Box>

                <Typography
                    level="h4"
                    sx={{
                        color: "rgba(255, 255, 255, 0.9)",
                        fontWeight: 600,
                        mb: 0.5,
                    }}
                >
                    Request to Join
                </Typography>

                <Typography
                    level="h3"
                    sx={{
                        background: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
                        WebkitBackgroundClip: "text",
                        WebkitTextFillColor: "transparent",
                        fontWeight: 700,
                        mb: 2.5,
                    }}
                >
                    {openJoinGM.chatName}
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
                        onClick={() => setOpenJoinGM(disableOpenJoinGMParams)}
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
                        onClick={handleJoinGM}
                        endDecorator={<SendIcon sx={{ fontSize: 16 }} />}
                        sx={{
                            background: "linear-gradient(135deg, #a855f7 0%, #8b5cf6 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(168, 85, 247, 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(168, 85, 247, 0.4)",
                            },
                        }}
                    >
                        Send Request
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
