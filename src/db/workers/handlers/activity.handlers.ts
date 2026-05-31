// Activity-channel handlers. Consolidates the 4 single-purpose activity
// workers (addActivityMessage, loadActivityHistory, popActivityMessages,
// updateActivityReadStatus).

import axios from "axios";

import { loadActivityHistory } from "../../../features/chat/components/sidebar/activity/services/loadActivityHistory";
import { v3ApiBaseURL } from "../../../services/v3Api";
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
        const ok = await activityService.addActivityMessage(activityMessage);
        // eslint-disable-next-line no-console
        console.log(
            `[worker:addActivityMessage] ok=${ok} key=${activityMessage?.activityId} ` +
                `tsSent=${activityMessage?.tsSent}`
        );
        // Sanity check — read back immediately so we can confirm the row
        // actually landed. Diagnoses silent put() failures (e.g. schema
        // mismatch, IndexedDB constraint violation) that `BaseRepository.put`
        // currently swallows.
        const all = await activityService.getAllActivityMessages();
        // eslint-disable-next-line no-console
        console.log(`[worker:addActivityMessage] post-write IDB has ${all.length} rows`);
    },

    loadActivityHistory: async ({ myself, accessToken }) => {
        await syncWithCheckpoint({
            // Bumped to "activity-v3" so existing clients re-fetch
            // every activity row and pick up the new
            // `mentionedViaGroups` field that drives the "By group"
            // filter. Pre-v3 rows have no field at all (it's `undefined`
            // instead of `{}`), which the predicate treats the same as
            // an empty map — so the bump is mostly a UX nicety: without
            // it, recently-cached mention activities couldn't be
            // filtered until they aged out of the 30-day window.
            //
            // Previous bump (activity-v2): mention rows used to be
            // stored under live-push "1-<chat_type>-..." activityIds
            // while REST refreshes returned "3-<chat_type>-...", so
            // users carried a shadow "1-..." row alongside every
            // refreshed "3-..." entry. A full reload wipes the stale
            // half cleanly.
            key: "activity-v3",
            fetcher: async (since) => {
                const response = await loadActivityHistory(myself, accessToken, since);
                if (!response) {
                    throw new Error("Failed to load activity history");
                }
                return {
                    serverTime: response.serverTime,
                    data: response.activity,
                    forceFull: response.forceFull,
                };
            },
            applier: async (activities, hadCheckpoint) => {
                // Full load: wipe before insert (legacy behavior).
                // Incremental: upsert in place plus apply tombstones for
                // any rows the server flagged is_deleted=True (e.g. a
                // reaction the user unreacted). The server includes
                // edited rows by ts_updated_at, so put() is idempotent.
                if (!hadCheckpoint) {
                    await activityService.clearActivityMessages();
                }
                const toUpsert: ActivityMessageProps[] = [];
                for (const a of activities) {
                    if (a.isDeleted) {
                        await activityService.deleteActivityMessage(a.activityId);
                    } else {
                        const { isDeleted: _ignored, ...rest } = a;
                        toUpsert.push(rest);
                    }
                }
                for (let i = 0; i < toUpsert.length; i += BATCH_SIZE) {
                    await activityService.batchInsertActivityMessages(
                        toUpsert.slice(i, i + BATCH_SIZE)
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
        // eslint-disable-next-line no-console
        console.log(
            `[worker:popActivityMessages] myself.userId=${myself.userId} raw_count=${messages.length}`
        );
        // eslint-disable-next-line no-console
        console.log(
            "[worker:popActivityMessages] sample raw rows",
            messages.slice(0, 3).map((m) => ({
                activityId: m.activityId,
                activityType: m.activityType,
                senderId: m.senderId,
                isThread: m.isThread,
                mentionedUserIds: m.mentionedUserIds,
            }))
        );
        const filtered = messages.filter(
            (m) => !(m.activityType === 2 && myself.userId !== m.senderId)
        );
        // eslint-disable-next-line no-console
        console.log(`[worker:popActivityMessages] after filter=${filtered.length}`);
        return [...filtered].sort(
            (a, b) => new Date(b.tsSent).getTime() - new Date(a.tsSent).getTime()
        );
    },

    updateActivityReadStatus: async ({
        accessToken,
        myself: _myself,
        activityId,
        isRead: _isRead,
        activityMessages,
    }) => {
        try {
            if (accessToken) {
                await axios.put(
                    `${v3ApiBaseURL()}/api/v3/activities/${encodeURIComponent(activityId)}/read/`,
                    {},
                    {
                        headers: { Authorization: `Bearer ${accessToken}` },
                        withCredentials: true,
                    }
                );
            }
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
