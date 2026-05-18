// Activity-channel handlers. Consolidates the 4 single-purpose activity
// workers (addActivityMessage, loadActivityHistory, popActivityMessages,
// updateActivityReadStatus).

import axios from "axios";

import { loadActivityHistory } from "../../../features/chat/services/loadActivityHistory";
import { authApi } from "../../../services/api";
import type { ActivityMessageProps } from "../../../types/chat";
import { ActivityService } from "../../services";
import type { ActivityRequests } from "../contracts";
import type { HandlerMap } from "../poolWorker";

const BATCH_SIZE = 1000;
const activityService = new ActivityService();

export const activityHandlers: HandlerMap<ActivityRequests> = {
    addActivityMessage: async ({ activityMessage }) => {
        await activityService.addActivityMessage(activityMessage);
        return "done";
    },

    loadActivityHistory: async ({ myself, accessToken }) => {
        await activityService.clearActivityMessages();
        const history = await loadActivityHistory(myself, accessToken);
        if (history) {
            for (let i = 0; i < history.length; i += BATCH_SIZE) {
                await activityService.batchInsertActivityMessages(
                    history.slice(i, i + BATCH_SIZE)
                );
            }
        }
        return "done";
    },

    popActivityMessages: async ({ myself }) => {
        const messages: ActivityMessageProps[] = await activityService.getAllActivityMessages();
        return [...messages]
            .filter((m) => !(m.activityType === 2 && myself.userId !== m.senderId))
            .sort((a, b) => new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime());
    },

    updateActivityReadStatus: async ({
        accessToken,
        myself,
        activityId,
        isRead,
        activityMessages,
    }) => {
        try {
            const api = authApi(accessToken);
            if (!api) {
                console.error("Unauthorized. Auth toke is not found.");
                return { error: "Unauthorized. Auth toke is not found." };
            }
            await api.put("/chat/activity/read/", {
                activity_id: activityId,
                is_read: isRead,
                team_id: myself.teamId,
                user_id: myself.userId,
            });

            const updated = [...activityMessages];
            const idx = updated.findIndex((item) => item.activityId === activityId);
            if (idx !== -1) {
                const next = { ...updated[idx], isRead: true };
                updated[idx] = next;
                await activityService.addActivityMessage(next);
            }
            return updated;
        } catch (error: unknown) {
            if (axios.isAxiosError(error)) {
                console.error(
                    "[activity:updateReadStatus] API error",
                    error.response?.status,
                    error.response?.data
                );
            } else {
                console.error("[activity:updateReadStatus] Unexpected error", error);
            }
            return { error: String(error) };
        }
    },
};
