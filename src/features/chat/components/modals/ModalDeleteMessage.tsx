import React, { useState } from "react";
import { Modal, ModalDialog, Alert, Stack, Button, Typography } from "@mui/joy";

import { deleteMessage } from "../../services/deleteMessage";
import { ChatProps, MessageProps, ThreadMessageProps, ThreadProps } from "../../../../types/chat";
import { deleteData } from "../../../../db/crud";
import { STORES } from "../../../../db/conf";
import { deleteThreadMessage } from "../../services/deleteThreadMessage";

type Props = {
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

    const handleDeleteMessage = async () => {
        if (message) {
            if (isThread) {
                if (currentThreadChat && setCurrentThreadChat && message.threadId) {
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
                        deleteData({
                            storeName: STORES.DM_THREAD_MESSAGES,
                            key: `${message.chatId}-${message.messageId}`,
                        });
                    } else if (message.chatType === 2) {
                        deleteData({
                            storeName: STORES.GM_THREAD_MESSAGES,
                            key: `${message.chatId}-${message.messageId}`,
                        });
                    } else if (message.chatType === 3) {
                        deleteData({
                            storeName: STORES.PM_THREAD_MESSAGES,
                            key: `${message.chatId}-${message.messageId}`,
                        });
                    }

                    // Delete message from the pane/message array
                    setCurrentThreadChat({
                        ...currentThreadChat,
                        messages: currentThreadChat.messages.filter(
                            (m) => m.messageId !== message.messageId
                        ) as ThreadMessageProps[],
                        notMove: true,
                    });

                    // Close modal
                    setOpenDeleteMessage(false);
                    setErrorMessage(null);
                } else {
                    console.error("currentThreadChat or setCurrentThreadChat is not defined");
                    setErrorMessage("Failed to delete message from thread");
                }
            } else {
                if (currentChat && setCurrentChat) {
                    // Delete message from backend
                    await deleteMessage(
                        accessToken,
                        message.chatType,
                        message.chatId,
                        message.messageId
                    );

                    // Delete message from indexedDB
                    if (message.chatType === 1) {
                        deleteData({
                            storeName: STORES.DM_MESSAGES,
                            key: `${message.chatId}-${message.messageId}`,
                        });
                    } else if (message.chatType === 2) {
                        deleteData({
                            storeName: STORES.GM_MESSAGES,
                            key: `${message.chatId}-${message.messageId}`,
                        });
                    } else if (message.chatType === 3) {
                        deleteData({
                            storeName: STORES.PM_MESSAGES,
                            key: `${message.chatId}-${message.messageId}`,
                        });
                    }

                    // Delete message from the pane/message array
                    setCurrentChat({
                        ...currentChat,
                        messages: currentChat.messages.filter(
                            (m) => m.messageId !== message.messageId
                        ) as MessageProps[],
                        notMove: true,
                    });

                    // Close modal
                    setOpenDeleteMessage(false);
                    setErrorMessage(null);
                } else {
                    console.error("currentChat or setCurrentChat is not defined");
                    setErrorMessage("Failed to delete message from chat");
                }
            }
        }
    };

    return (
        <>
            <Modal
                sx={{ zIndex: 10010 }}
                open={openDeleteMessage}
                onClose={() => setOpenDeleteMessage(false)}
            >
                <ModalDialog>
                    <Typography level="h4">
                        Are you sure you want to delete the message?
                    </Typography>
                    {errorMessage && errorMessage !== "" && (
                        <Alert color="danger">{errorMessage}</Alert>
                    )}
                    <Stack direction="row" spacing={1} sx={{ mt: 2, justifyContent: "center" }}>
                        <Button
                            component="button"
                            color="neutral"
                            variant="outlined"
                            onClick={() => setOpenDeleteMessage(false)}
                        >
                            Cancel
                        </Button>
                        <Button
                            component="button"
                            color="danger"
                            onClick={() => {
                                handleDeleteMessage();
                            }}
                        >
                            Delete
                        </Button>
                    </Stack>
                </ModalDialog>
            </Modal>
        </>
    );
};
