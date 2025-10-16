import { Socket } from "socket.io-client";

import { addInboxItem } from "../../../features/admin/services/addInboxItem";
import { addUser } from "../../../features/admin/services/addUser";
import { UserProps } from "../../../types/admin";
import { InboxItemProps } from "../../../types/common";
import { ChatManagementState } from "../../chats/useChatManagement";
import { handleActivityMessage } from "./activity-handlers";
import { handleRegularMessage, handleThreadMessage } from "./message-handlers";

export const setupWebSocketHandlers = (
    socket: Socket,
    myself: UserProps,
    accessToken: string | null,
    currentProject: any,
    currentPreviewTaskId: number,
    setIsTaskUpdatedBySomeone: (value: boolean) => void,
    setIsTaskCommentUpdated: (value: { isUpdate: boolean; scrollToBottom: boolean }) => void,
    funcSetInboxItems: () => void,
    CM: ChatManagementState
) => {
    socket.on("connect", () => {
        console.log("WS connected");
    });

    socket.on("disconnect", (reason, details) => {
        console.warn("WS disconnected");
        console.log(reason);
    });

    socket.on("connect_error", (err) => {
        console.error("WS connection error");
        console.log(err.message);
    });

    socket.on("auth_error", (data) => {
        console.error("Authentication Error:", data.message);
    });

    socket.on("message", async (message) => {
        if (message.wsType === "chat") {
            console.log("chat_message:", message);
            if (message.chatId !== null) {
                if (message.isThread === true) {
                    await handleThreadMessage(message, myself, accessToken, CM);
                } else {
                    await handleRegularMessage(
                        message,
                        myself,
                        currentProject,
                        currentPreviewTaskId,
                        setIsTaskUpdatedBySomeone,
                        CM,
                        socket
                    );
                }
            }
        } else if (message.wsType === "task") {
            console.log("Got a task comment");
            console.log("task_message:", message);
            if (setIsTaskCommentUpdated) {
                setIsTaskCommentUpdated({ isUpdate: true, scrollToBottom: false });
            }
        } else if (message.wsType === "activity") {
            console.log("Got an activity message");
            console.log("activity_message:", message);
            await handleActivityMessage(message, myself, CM);
        } else if (message.wsType === "userStatus") {
            const user: UserProps = message.user;
            await addUser(user);
        } else if (message.wsType === "inbox") {
            console.log("Got an inbox message");
            console.log("inbox_message:", message);

            const inboxItem: InboxItemProps = message.data;
            if (message.alreadyExist === false) {
                await addInboxItem(inboxItem);
                funcSetInboxItems();
            }
        }
    });
};

export const cleanupWebSocketHandlers = (socket: Socket) => {
    socket.off("message");
    socket.off("connect");
    socket.off("disconnect");
    socket.off("connect_error");
    socket.off("auth_error");
};
