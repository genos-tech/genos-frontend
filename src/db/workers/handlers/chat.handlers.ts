// Chat-channel handlers — runs inside the chat worker.
//
// Post-v3 cutover, the only handlers that remain are the two
// activity/read-status mutation paths that still hit the legacy
// `/chat/activity/read/all/` and `/chat/read/` REST endpoints. All
// per-type chat list / message / thread / flag IDB plumbing was
// removed once the v3 `channelService` became the single source of
// truth for chat-list, messages, threads, pins, flags, and read
// cursors.

import axios from "axios";

import { authApi } from "../../../services/api";
import { ActivityMessageProps } from "../../../types/chat";
import { ActivityService } from "../../services";
import type { ChatRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";

export const chatHandlers: HandlerMap<ChatRequests> = {
    markAllChatActivityAsRead: async ({
        accessToken,
        myself,
        chatType,
        chatId,
        activityMessages,
    }) => {
        try {
            const api = authApi(accessToken);
            if (!api) {
                return { error: "Unauthorized. Auth token is not found." };
            }
            await api.put("/chat/activity/read/all/", {
                chat_id: chatId,
                chat_type: chatType,
                team_id: myself.teamId,
                user_id: myself.userId,
            });
            const affected: ActivityMessageProps[] = [];
            const updated: ActivityMessageProps[] = activityMessages.map((a) => {
                if (a.chatType === chatType && a.chatId === chatId && a.isRead === false) {
                    const next = { ...a, isRead: true };
                    affected.push(next);
                    return next;
                }
                return a;
            });
            if (affected.length > 0) {
                const activityService = new ActivityService();
                await activityService.batchInsertActivityMessages(affected);
            }
            return updated;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error(
                    "[chat:markAllChatActivityAsRead] API error",
                    error.response?.status,
                    error.response?.data
                );
            } else {
                console.error("[chat:markAllChatActivityAsRead] Unexpected error", error);
            }
            return { error: String(error) };
        }
    },

    updateReadStatus: async ({
        accessToken,
        myself,
        chatType,
        chatId,
        isThread,
        threadId,
        lastReadMessageId,
    }) => {
        try {
            const api = authApi(accessToken);
            if (!api) {
                console.error("Unauthorized. Auth toke is not found.");
                return;
            }
            await api.put("/chat/read/", {
                chat_id: chatId,
                chat_type: chatType,
                is_thread: isThread,
                last_read_message_id: lastReadMessageId,
                team_id: myself.teamId,
                thread_id: threadId,
                user_id: myself.userId,
            });
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error(
                    "[chat:updateReadStatus] API error",
                    error.response?.status,
                    error.response?.data
                );
            } else {
                console.error("[chat:updateReadStatus] Unexpected error", error);
            }
        }
    },
};
