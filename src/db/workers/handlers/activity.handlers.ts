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
        // Sanity check — read back immediately so we can confirm the row
        // actually landed. Diagnoses silent put() failures (e.g. schema
        // mismatch, IndexedDB constraint violation) that `BaseRepository.put`
        // currently swallows.
        const all = await activityService.getAllActivityMessages();
    },

    loadActivityHistory: async ({ myself, accessToken, forceFull }) => {
        await syncWithCheckpoint({
            // Caller-forced full reload (wake refresh) — re-fetches rows
            // whose `is_read` flipped on another device, which the
            // `ts_created_at`-keyed incremental delta never sees because
            // `Activity` has no `ts_updated_at`.
            forceFull,
            // Bumped to "activity-v7": rows now carry `teamId`, which the
            // feed filters on. Rows already in IDB don't have it and an
            // incremental sync never re-fetches them, so without the bump
            // a returning user's whole feed would read as "not this
            // team's" and disappear. The bump forces the full reload that
            // re-adapts every row with its team.
            //
            // Previous bump (activity-v6): the adapter now stores
            // `firstLineMediaKind` so a media-only message (a GIF posts
            // an image block and NO body_text) can be labelled instead
            // of rendering an empty row. The field is written at adapt
            // time, so rows already in IDB don't have it and an
            // incremental sync never re-fetches them — same situation
            // as the v3 bump below, same fix.
            //
            // Previous bump (activity-v5): chat-note (surface 8) activity meta
            // (chatType/chatId/threadId) was being DROPPED on the backend —
            // the Flask note_mention handler int()-parsed the thread-root
            // UUID, threw, and nulled chat_type in the same except, so
            // `_build_meta` skipped the parent-chat block. Every existing
            // chat-note row therefore lacked the parent-chat ids the
            // `ActivityAvatar` chatType=8 lookup needs and fell back to the
            // tinted icon. The handler is fixed and those rows are now
            // backfilled in the DB. `Activity` has no `ts_updated_at`, so an
            // incremental sync never re-fetches old (backfilled) rows — only
            // a full reload does. Bumping the key invalidates every client's
            // checkpoint (including "activity-v4", set during the broken
            // retest) and forces that full reload.
            //
            // Previous bump (activity-v4): chat-note parent-chat fields —
            //   insufficient alone, the meta was never stored to re-adapt.
            // Previous bump (activity-v3): picked up `mentionedViaGroups`.
            // Previous bump (activity-v2): de-duped live-push vs REST ids.
            key: "activity-v7",
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
        const filtered = messages.filter(
            (m) =>
                // Reactions are only interesting to the person reacted to.
                !(m.activityType === 2 && myself.userId !== m.senderId) &&
                // One team's feed at a time: the store can hold another
                // team's rows, because a live `activity.created` push
                // arrives in the recipient's per-USER socket room whichever
                // team is on screen. Only rows that positively belong to
                // another team are dropped — a row with no team at all came
                // from a backend that predates the field, and hiding those
                // would empty the feed if the API hasn't been deployed yet.
                !(m.teamId && myself.teamId && m.teamId !== myself.teamId)
        );

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
