// Chat-channel handlers — runs inside the chat worker.
//
// Post-v3 cutover, the only remaining handler is the activity
// "mark-all-as-read" mutation. It now talks to the v3 endpoint
// `PUT /api/v3/activities/read-all/` (the legacy `/chat/activity/read/all/`
// was deleted). Activity rows are scoped per-channel via `?channel_id=`.

import axios from "axios";

import { v3ApiBaseURL } from "../../../services/v3Api";
import { ActivityMessageProps } from "../../../types/chat";
import { ActivityService } from "../../services";
import type { ChatRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";

export const chatHandlers: HandlerMap<ChatRequests> = {
    markAllChatActivityAsRead: async ({
        accessToken,
        myself: _myself,
        chatType,
        chatId,
        activityMessages,
    }) => {
        try {
            if (accessToken) {
                // Channel id is the v3 UUID (kept through the legacy
                // `chatId: number` slot via the migration cast). The v3
                // endpoint scopes by `channel_id` query param. Hits the
                // Django host directly (not via authApi) since authApi's
                // baseURL ends in `/api/v2/`.
                await axios.put(
                    `${v3ApiBaseURL()}/api/v3/activities/read-all/?channel_id=${encodeURIComponent(String(chatId))}`,
                    {},
                    {
                        headers: { Authorization: `Bearer ${accessToken}` },
                        withCredentials: true,
                    }
                );
            }
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
};
