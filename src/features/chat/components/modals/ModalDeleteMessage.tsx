import React, { Dispatch, SetStateAction, useState } from "react";
import DeleteOutlineIcon from "@mui/icons-material/DeleteOutline";
import { Socket } from "socket.io-client";

import { ConfirmDialog } from "../../../../components/ui/modal/ConfirmDialog";
import { useTranslation } from "../../../../i18n";
import { g } from "../../../../theme/tokens";
import {
    ChatProps,
    FlaggedMessageProps,
    MessageProps,
    ThreadMessageProps,
    ThreadProps,
} from "../../../../types/chat";
import { deleteMessage } from "../../services/deleteMessage";
import { deleteThreadMessage } from "../../services/deleteThreadMessage";

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
                    // `isThread` branch ⇒ message is a ThreadMessageProps (this
                    // field is thread-only); narrow the MessageProps|ThreadMessageProps union.
                    (message as ThreadMessageProps).messageIdWithChatIdAndThreadId ?? "",
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
                    // non-thread branch ⇒ message is a MessageProps (this field
                    // is main-pane-only); narrow the union.
                    (message as MessageProps).messageIdWithChatId ?? "",
                    setErrorMessage
                );
            } catch (err) {
                console.error("Failed to delete message from backend/IndexedDB:", err);
            }
        }
    };

    return (
        <ConfirmDialog
            cancelLabel={t.chat.modals.deleteMessage.cancel}
            confirmLabel={t.chat.modals.deleteMessage.delete}
            description={t.chat.modals.deleteMessage.description}
            error={errorMessage}
            icon={<DeleteOutlineIcon sx={{ color: g.danger.text }} />}
            open={openDeleteMessage}
            title={t.chat.modals.deleteMessage.title}
            destructive
            onClose={() => setOpenDeleteMessage(false)}
            onConfirm={handleDeleteMessage}
        />
    );
};
