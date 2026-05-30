// Chat-channel handlers — runs inside the chat worker.
//
// Post-v3 cutover, the only remaining handler is the activity
// "mark-all-as-read" mutation, which still hits the legacy
// `/chat/activity/read/all/` endpoint and writes to the activity IDB
// store. Activity is a separate domain from chat — `channelService`
// owns chat-list / messages / threads / flags / pins / read cursors,
// but the activity feed (mentions, task assignments, thread-reply
// notifications) is not part of the v3 channel surface.

import { ActivityMessageProps } from "../../../types/chat";
import { ActivityService } from "../../services";
import type { ChatRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";

export const chatHandlers: HandlerMap<ChatRequests> = {
    markAllChatActivityAsRead: async ({
        accessToken: _accessToken,
        myself: _myself,
        chatType,
        chatId,
        activityMessages,
    }) => {
        try {
            // `/chat/activity/read/all/` was deleted in Phase 3 of the
            // legacy-chat retirement. We still update the local IDB
            // copy so the badge clears immediately — the network sync
            // will return when the activity feed is rebuilt on v3.
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
            console.error("[chat:markAllChatActivityAsRead] Unexpected error", error);
            return { error: String(error) };
        }
    },
};
