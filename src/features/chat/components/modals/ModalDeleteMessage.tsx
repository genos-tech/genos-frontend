import React, { useState } from "react";
import { keyframes } from "@emotion/react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { ChatService } from "../../../../db/services/chat.service";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { deleteMessage } from "../../services/deleteMessage";
import { deleteThreadMessage } from "../../services/deleteThreadMessage";

const fadeIn = keyframes`
    from { opacity: 0; transform: scale(0.95) translateY(-10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
`;

const shake = keyframes`
    0%, 100% { transform: rotate(0deg); }
    25% { transform: rotate(-5deg); }
    75% { transform: rotate(5deg); }
`;

type Props = {
    socket: Socket | null;
    openDeleteMessage: boolean;
    setOpenDeleteMessage: (value: boolean) => void;
    message: MessageProps | ThreadMessageProps;
    accessToken: string | null;
    isThread: boolean;
    currentChat?: ChatProps;
    setCurrentChat?: (chat: ChatProps) => void;
    currentThreadChat?: ThreadProps;
    setCurrentThreadChat?: (chat: ThreadProps) => void;
};

export const ModalDeleteMessage: React.FC<Props> = ({
    socket,
    openDeleteMessage,
    setOpenDeleteMessage,
    message,
    accessToken,
    isThread,
    currentChat,
    setCurrentChat,
    currentThreadChat,
    setCurrentThreadChat,
}) => {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const chatService = new ChatService();

    const handleDeleteMessage = async () => {
        if (message) {
            if (isThread) {
                if (socket && currentThreadChat && setCurrentThreadChat && message.threadId) {
                    // Delete message from backend
                    await deleteThreadMessage(
                        accessToken,
                        message.chatType,
                        message.chatId,
                        message.threadId,
                        message.messageId
                    );

                    // Delete message from indexedDB
                    if (message.chatType === 1) {
                        await chatService.deleteDMThreadMessage(message.chatId, message.messageId);
                    } else if (message.chatType === 2) {
                        await chatService.deleteGMThreadMessage(message.chatId, message.messageId);
                    } else if (message.chatType === 3) {
                        await chatService.deletePMThreadMessage(message.chatId, message.messageId);
                    } else if (message.chatType === 4) {
                        await chatService.deleteMDMThreadMessage(message.chatId, message.messageId);
                    }

                    // Delete message from the pane/message array
                    setCurrentThreadChat({
                        ...currentThreadChat,
                        messages: currentThreadChat.messages.filter(
                            (m) => m.messageId !== message.messageId
                        ) as ThreadMessageProps[],
                        notMove: true,
                    });

                    socket.emit("thread_message", {
                        methodType: "DELETE",
                        chatType: message.chatType,
                        destCGId: message.chatId,
                        threadId: message.threadId,
                        messageIdForDelete: message.messageId,
                    });

                    // Close modal
                    setOpenDeleteMessage(false);
                    setErrorMessage(null);
                } else {
                    console.error(
                        "socket or currentThreadChat or setCurrentThreadChat is not defined"
                    );
                    setErrorMessage("Failed to delete message from thread");
                }
            } else {
                if (socket && currentChat && setCurrentChat) {
                    // Delete message from backend
                    await deleteMessage(
                        accessToken,
                        message.chatType,
                        message.chatId,
                        message.messageId
                    );

                    // Delete message from indexedDB
                    if (message.chatType === 1) {
                        await chatService.deleteDMMessage(message.chatId, message.messageId);
                    } else if (message.chatType === 2) {
                        await chatService.deleteGMMessage(message.chatId, message.messageId);
                    } else if (message.chatType === 3) {
                        await chatService.deletePMMessage(message.chatId, message.messageId);
                    } else if (message.chatType === 4) {
                        await chatService.deleteMDMMessage(message.chatId, message.messageId);
                    }

                    // Delete message from the pane/message array
                    setCurrentChat({
                        ...currentChat,
                        messages: currentChat.messages.filter(
                            (m) => m.messageId !== message.messageId
                        ) as MessageProps[],
                        notMove: true,
                    });

                    socket.emit("message", {
                        methodType: "DELETE",
                        chatType: message.chatType,
                        destCGId: message.chatId,
                        messageIdForDelete: message.messageId,
                    });

                    // Close modal
                    setOpenDeleteMessage(false);
                    setErrorMessage(null);
                } else {
                    console.error("socket or currentChat or setCurrentChat is not defined");
                    setErrorMessage("Failed to delete message from chat");
                }
            }
        }
    };

    return (
        <Modal
            open={openDeleteMessage}
            sx={{
                zIndex: 10010,
                backdropFilter: "blur(4px)",
                backgroundColor: "rgba(0, 0, 0, 0.5)",
            }}
            onClose={() => setOpenDeleteMessage(false)}
        >
            <ModalDialog
                sx={{
                    animation: `${fadeIn} 0.2s ease-out`,
                    background:
                        "linear-gradient(145deg, rgba(30, 30, 40, 0.95) 0%, rgba(20, 20, 28, 0.98) 100%)",
                    border: "1px solid rgba(239, 68, 68, 0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(239, 68, 68, 0.1)",
                    minWidth: "320px",
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
                        background:
                            "linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(220, 38, 38, 0.15) 100%)",
                        border: "1px solid rgba(239, 68, 68, 0.25)",
                        mx: "auto",
                        mb: 2,
                        "&:hover": {
                            animation: `${shake} 0.4s ease-in-out`,
                        },
                    }}
                >
                    <DeleteOutlineIcon sx={{ color: "rgba(239, 68, 68, 0.9)", fontSize: 28 }} />
                </Box>

                {/* Title */}
                <Typography
                    level="h4"
                    sx={{
                        color: "rgba(255, 255, 255, 0.9)",
                        fontWeight: 600,
                        mb: 1,
                    }}
                >
                    Delete Message?
                </Typography>

                {/* Description */}
                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.5)",
                        mb: 2.5,
                    }}
                >
                    This action cannot be undone
                </Typography>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        startDecorator={<WarningAmberIcon />}
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(239, 68, 68, 0.1)",
                            border: "1px solid rgba(239, 68, 68, 0.3)",
                        }}
                    >
                        {errorMessage}
                    </Alert>
                )}

                {/* Action Buttons */}
                <Stack direction="row" spacing={1.5} sx={{ justifyContent: "center" }}>
                    <Button
                        variant="plain"
                        onClick={() => setOpenDeleteMessage(false)}
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
                        onClick={handleDeleteMessage}
                        sx={{
                            background: "linear-gradient(135deg, #ef4444 0%, #dc2626 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(239, 68, 68, 0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(239, 68, 68, 0.4)",
                            },
                        }}
                    >
                        Delete
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
