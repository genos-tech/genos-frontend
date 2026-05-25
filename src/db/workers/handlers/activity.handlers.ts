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
import { syncWithCheckpoint } from "../utils/syncWithCheckpoint";

const BATCH_SIZE = 1000;
// Activity feed only shows the most recent 30 days. Incremental sync
// only adds new rows, so without this prune the store would grow
// unboundedly across sessions.
const ACTIVITY_RETENTION_DAYS = 30;
const activityService = new ActivityService();

export const activityHandlers: HandlerMap<ActivityRequests> = {
    addActivityMessage: async ({ activityMessage }) => {
        await activityService.addActivityMessage(activityMessage);
    },

    loadActivityHistory: async ({ myself, accessToken }) => {
        await syncWithCheckpoint({
            key: "activity",
            fetcher: async (since) => {
                const response = await loadActivityHistory(myself, accessToken, since);
                if (!response) {
                    throw new Error("Failed to load activity history");
                }
                return { serverTime: response.serverTime, data: response.activity };
            },
            applier: async (activities, hadCheckpoint) => {
                // Full load: wipe before insert (legacy behavior).
                // Incremental: upsert in place. The server includes
                // edited rows by ts_updated_at, so put() is idempotent.
                if (!hadCheckpoint) {
                    await activityService.clearActivityMessages();
                }
                for (let i = 0; i < activities.length; i += BATCH_SIZE) {
                    await activityService.batchInsertActivityMessages(
                        activities.slice(i, i + BATCH_SIZE)
                    );
                }
            },
        });

        const cutoff = new Date(
            Date.now() - ACTIVITY_RETENTION_DAYS * 24 * 60 * 60 * 1000
        ).toISOString();
        await activityService.pruneActivitiesOlderThan(cutoff);
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
