import { Socket } from "socket.io-client";

import { addInboxItem } from "../../../features/admin/services/addInboxItem";
import { addUser } from "../../../features/admin/services/addUser";
import { NotificationManager } from "../../../services/notifications/notificationManager";
import { buildIntentFromMessage } from "../../../services/notifications/notificationRouter";
import { UserProps } from "../../../types/admin";
import { MessageProps } from "../../../types/chat";
import { InboxItemProps } from "../../../types/common";
import { ChatManagementState } from "../../chats/useChatManagement";
import { TeamManagementState } from "../useTeamManagement";
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
    useCM: ChatManagementState,
    useTEM: TeamManagementState,
    notificationManager?: NotificationManager
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
        // Run the notification router alongside the existing data-sync
        // dispatch. Failures here must never break sync, hence the
        // try/catch.
        if (notificationManager) {
            try {
                const intent = buildIntentFromMessage(message, myself, useTEM, useCM);
                if (intent) notificationManager.notify(intent);
            } catch (err) {
                console.warn("[notifications] router error", err);
            }
        }

        if (message.wsType === "chat") {
            // v3 cutover: chat events now flow through the `/v3`
            // namespace via channelService — this legacy `/` namespace
            // dispatch is disabled to prevent bleed. The bleed bug
            // it caused: handleRegularMessage / handleThreadMessage
            // call `useCM.setAllChats((prev) => [legacyChat, ...prev])`
            // with `chatId: String(legacy_int)`. Those integer-keyed
            // AllChatProps would then live alongside v3 UUID-keyed
            // chats in the same list. Any subsequent
            // `channelService.send(chat.chatId, ...)` against one of
            // those legacy-keyed entries 404'd at
            // `/api/v3/channels/{int}/messages/` because the v3 URL
            // pattern is `<uuid:channel_id>`.
            //
            // Trade-off: legacy-only chats (no v3 Channel mirror row)
            // will no longer appear in the chat list. Resolution:
            // either run `backfill_v3_channels` (Track B) so each
            // legacy chat gets a v3 Channel UUID, or wipe legacy data
            // and start fresh via the v3 creation path.
            //
            // Notification routing above still runs — the
            // notificationManager.notify call doesn't mutate React
            // state and only surfaces toasts / push notifications.
            return;
        } else if (message.wsType === "task") {
            // console.log("Got a task comment");
            // console.log("task_message:", message);
            if (setIsTaskCommentUpdated) {
                setIsTaskCommentUpdated({ isUpdate: true, scrollToBottom: false });
            }

            // Live-bump the PM bubble's `taskCommentCount` chip. Without
            // this, the chip stays stale until the user refreshes the
            // page (the backend only computes the count on history
            // fetches). Only POST events grow the count — PUTs are
            // edits (`isEdited: true`) and the backend has no DELETE
            // handler for task comments, so this single update covers
            // every count-changing path today.
            //
            // The same `wsType: "task"` event is broadcast back to the
            // sender too (Flask-SocketIO `send` includes self by
            // default), so the same handler updates both author and
            // observers — no separate optimistic path needed.
            //
            // We derive the new total from `message.commentId`. The
            // backend assigns `comment_id = current_count + 1` on POST
            // (see `TaskCommentsView.post`), so `commentId` equals the
            // post-insert total. Using it directly with `Math.max`
            // makes the bump idempotent against socket replays and
            // out-of-order delivery (e.g. if the parent-message
            // broadcast already set the count to the new value).
            const taskId = message.taskId;
            const newTotal = Number(message.commentId);
            const isNewComment =
                message.isEdited !== true &&
                message.isReactionUpdated !== true &&
                Number.isFinite(newTotal) &&
                newTotal > 0;
            if (taskId != null && isNewComment) {
                const bumpMessages = (msgs: MessageProps[]): MessageProps[] => {
                    let mutated = false;
                    const next = msgs.map((m) => {
                        if (m.taskId !== taskId) return m;
                        const nextCount = Math.max(m.taskCommentCount ?? 0, newTotal);
                        if (nextCount === m.taskCommentCount) return m;
                        mutated = true;
                        return { ...m, taskCommentCount: nextCount };
                    });
                    return mutated ? next : msgs;
                };

                if (useCM.currentMainChat) {
                    const next = bumpMessages(useCM.currentMainChat.messages);
                    if (next !== useCM.currentMainChat.messages) {
                        useCM.setCurrentMainChat({
                            ...useCM.currentMainChat,
                            messages: next,
                            notMove: true,
                        });
                    }
                }

                if (useCM.currentSubChat) {
                    const next = bumpMessages(useCM.currentSubChat.messages);
                    if (next !== useCM.currentSubChat.messages) {
                        useCM.setCurrentSubChat({
                            ...useCM.currentSubChat,
                            messages: next,
                            notMove: true,
                        });
                    }
                }

                // Also keep the chat-list summary's latest message in
                // sync — covers the case where the latest PM bubble in
                // the chat list happens to reference this task.
                useCM.setAllChats((prev) =>
                    prev.map((chat) => {
                        const latest = chat.latestMessage;
                        if (!latest || latest.taskId !== taskId) return chat;
                        const nextCount = Math.max(latest.taskCommentCount ?? 0, newTotal);
                        if (nextCount === latest.taskCommentCount) return chat;
                        return {
                            ...chat,
                            latestMessage: { ...latest, taskCommentCount: nextCount },
                        };
                    })
                );
            }
        } else if (message.wsType === "activity") {
            // console.log("Got an activity message");
            // console.log("activity_message:", message);
            await handleActivityMessage(message, myself, useCM);
        } else if (message.wsType === "userStatus") {
            const user: UserProps = message.user;
            await addUser(user);
        } else if (message.wsType === "inbox") {
            // console.log("Got an inbox message");
            // console.log("inbox_message:", message);

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
