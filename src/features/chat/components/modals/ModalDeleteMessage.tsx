import React, { Dispatch, SetStateAction, useState } from "react";
import { keyframes } from "@emotion/react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import WarningAmberIcon from "@mui/icons-material/WarningAmber";
import { Alert, Box, Button, Modal, ModalDialog, Stack, Typography } from "@mui/joy";
import { Socket } from "socket.io-client";

import { useTranslation } from "../../../../i18n";
import {
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../types/chat";
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
    flaggedMessages?: FlaggedMessageProps[];
    setFlaggedMessages?: Dispatch<SetStateAction<FlaggedMessageProps[]>>;
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
    flaggedMessages,
    setFlaggedMessages,
}) => {
    const [errorMessage, setErrorMessage] = useState<string | null>(null);
    const { t } = useTranslation();

    const cleanupFlaggedMessage = async (
        chatType: number,
        chatId: number,
        threadId: number,
        messageId: number
    ) => {
        if (!setFlaggedMessages) return;
        const flaggedId = `${chatType}-${chatId}-${threadId}-${messageId}`;
        // Use the functional updater so we read the latest flagged-messages
        // list at call time — `flaggedMessages` (the prop) can be a render
        // or two behind once the parent message-bubble is memoized.
        // `hadMatch` is captured inside the updater and read after.
        // Optimistic local removal. The v3 `channelService.deleteMessage`
        // chain also fires `_removeFlagByMessage`, which the
        // `useChatManagement` subscription picks up to re-derive
        // `flaggedMessages` from the snapshot — so even without this
        // optimistic update the row would clear within one notify
        // cycle, but updating eagerly avoids a one-frame flicker.
        setFlaggedMessages((prev) => prev.filter((fm) => fm.flaggedMessageId !== flaggedId));
    };

    const handleDeleteMessage = async () => {
        if (!message) return;

        if (isThread) {
            if (!socket || !currentThreadChat || !setCurrentThreadChat || !message.threadId) {
                console.error(
                    "socket or currentThreadChat or setCurrentThreadChat is not defined"
                );
                setErrorMessage(t.chat.modals.deleteMessage.errorDeleteFromThread);
                return;
            }

            // Update UI immediately
            setCurrentThreadChat({
                ...currentThreadChat,
                messages: currentThreadChat.messages.filter(
                    (m) => m.messageId !== message.messageId
                ) as ThreadMessageProps[],
                notMove: true,
            });
            setOpenDeleteMessage(false);
            setErrorMessage(null);

            // Remove from flagged messages if flagged
            cleanupFlaggedMessage(
                message.chatType,
                message.chatId,
                message.threadId,
                message.messageId
            );

            // v3 thread delete. The v3 model has thread replies as the
            // same `Message` row type as top-level messages, so the
            // delete emit is the same `channelService.deleteMessage`
            // call used by the main-pane delete branch. Now that the
            // thread loader is on v3, `ThreadMessageProps.
            // messageIdWithChatIdAndThreadId` carries the v3 message
            // UUID via the adapter — pass that through. The legacy
            // `socket.emit("thread_message", DELETE)` + axios PUT +
            // per-type IDB chatService cleanups all collapse into
            // this one call; the open thread's live-update
            // subscription patches the visible reply list off the
            // server's `message.deleted` broadcast.
            try {
                await deleteThreadMessage(
                    accessToken,
                    message.chatType,
                    message.chatId as unknown as string,
                    message.threadId,
                    message.messageIdWithChatIdAndThreadId ?? "",
                    setErrorMessage
                );
            } catch (err) {
                console.error("Failed to delete thread message:", err);
            }
        } else {
            if (!socket || !currentChat || !setCurrentChat) {
                console.error("socket or currentChat or setCurrentChat is not defined");
                setErrorMessage(t.chat.modals.deleteMessage.errorDeleteFromChat);
                return;
            }

            setOpenDeleteMessage(false);

            // Remove from flagged messages if flagged
            cleanupFlaggedMessage(message.chatType, message.chatId, 0, message.messageId);
            setErrorMessage(null);

            // v3 channelService.deleteMessage handles BOTH the
            // server-side soft-delete (Django) AND the broadcast to
            // other members (`message.deleted` on the channel room).
            // The legacy socket.emit("message", DELETE) + axios PUT +
            // per-type IDB chatService cleanups all collapse into one
            // call; the v3 store + IDB writes happen inside
            // channelService.handleMessageDeleted, and the open chat's
            // live-update subscription picks up the new state.
            //
            // No optimistic local filter: a previous version
            // pre-emptively filtered the message out of
            // `currentChat.messages` for snappier UI, but any
            // unrelated event (typing, reaction) that fires the
            // useSyncExternalStore subscription between the filter
            // and the server's `message.deleted` broadcast would
            // regenerate `currentChat.messages` from the still-
            // present-in-store row and visibly resurrect the
            // bubble. The v3 ack-then-broadcast roundtrip is fast
            // enough that the subscription-driven update is
            // imperceptible in practice.
            try {
                await deleteMessage(
                    accessToken,
                    message.chatType,
                    message.chatId as unknown as string,
                    message.messageIdWithChatId ?? "",
                    setErrorMessage
                );
            } catch (err) {
                console.error("Failed to delete message from backend/IndexedDB:", err);
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
                    border: "1px solid rgba(232,121,195,0.2)",
                    borderRadius: "16px",
                    boxShadow:
                        "0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px rgba(232,121,195,0.1)",
                    width: { xs: "calc(100vw - 24px)", md: "auto" },
                    minWidth: { xs: 0, md: "320px" },
                    maxWidth: "100vw",
                    p: { xs: 2, md: 3 },
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
                            "linear-gradient(135deg, rgba(232,121,195,0.15) 0%, rgba(192,38,168,0.15) 100%)",
                        border: "1px solid rgba(232,121,195,0.25)",
                        mx: "auto",
                        mb: 2,
                        "&:hover": {
                            animation: `${shake} 0.4s ease-in-out`,
                        },
                    }}
                >
                    <DeleteOutlineIcon sx={{ color: "rgba(232,121,195,0.9)", fontSize: 28 }} />
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
                    {t.chat.modals.deleteMessage.title}
                </Typography>

                {/* Description */}
                <Typography
                    level="body-sm"
                    sx={{
                        color: "rgba(255, 255, 255, 0.5)",
                        mb: 2.5,
                    }}
                >
                    {t.chat.modals.deleteMessage.description}
                </Typography>

                {/* Error Alert */}
                {errorMessage && (
                    <Alert
                        color="danger"
                        startDecorator={<WarningAmberIcon />}
                        sx={{
                            mb: 2,
                            borderRadius: "10px",
                            backgroundColor: "rgba(232,121,195,0.1)",
                            border: "1px solid rgba(232,121,195,0.3)",
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
                        {t.chat.modals.deleteMessage.cancel}
                    </Button>
                    <Button
                        onClick={handleDeleteMessage}
                        sx={{
                            background: "linear-gradient(135deg, #c026a8 0%, #9d2386 100%)",
                            borderRadius: "10px",
                            px: 3,
                            fontWeight: 600,
                            boxShadow: "0 4px 15px rgba(232,121,195,0.3)",
                            transition: "all 0.2s ease",
                            "&:hover": {
                                transform: "translateY(-1px)",
                                boxShadow: "0 6px 20px rgba(232,121,195,0.4)",
                            },
                        }}
                    >
                        {t.chat.modals.deleteMessage.delete}
                    </Button>
                </Stack>
            </ModalDialog>
        </Modal>
    );
};
