import { useCallback } from "react";
import axios from "axios";

import { useAuth } from "../../../context/AuthContext";
import { ActivityService } from "../../../db/services";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { v3ApiBaseURL } from "../../../services/v3Api";
import { ActivityMessageProps } from "../../../types/chat";
import { countUnreadActivityTopics, getAggregatedIds } from "../utils/activityAggregation";

interface UseMarkFilteredActivityReadProps {
    useCM: ChatManagementState;
}

interface UseMarkFilteredActivityReadResult {
    markFilteredAsRead: (filteredActivities: ActivityMessageProps[]) => void;
}

/**
 * Mark a caller-supplied set of activities as read.
 *
 * Unlike {@link useMarkAllChatActivityRead} (which is channel-scoped), this
 * marks the activities the caller passes in — the sidebar uses it to clear
 * the *currently-filtered* activity feed, a set that spans multiple
 * channels and channel-less surfaces (note mentions). Rows that carry
 * `aggregatedIds` (the same-topic-collapsed feed rows) are expanded to
 * their member activities first. It PUTs the unread subset's ids to the
 * v3 `/api/v3/activities/read-batch/` endpoint (which requires a
 * non-empty id list and so can never degrade into "mark everything"),
 * optimistically flips those rows in `useCM.activityMessages`, and
 * persists the affected rows to the activity IDB store.
 *
 * No-ops when the filtered set has no unread rows, so the empty-list 400
 * branch of the endpoint is never hit from a stale click.
 */
export const useMarkFilteredActivityRead = ({
    useCM,
}: UseMarkFilteredActivityReadProps): UseMarkFilteredActivityReadResult => {
    const { accessToken } = useAuth();

    const markFilteredAsRead = useCallback(
        (filteredActivities: ActivityMessageProps[]) => {
            if (!accessToken) {
                console.error("Cannot mark filtered as read: missing access token.");
                return;
            }
            // The visible feed is same-topic AGGREGATED: a row may stand in
            // for many stored activities (its `aggregatedIds`). Expand every
            // row to its members first — marking only the representative
            // would leave the hidden members stuck unread forever (nothing
            // visible left to clear them with). Then keep only the unread
            // members: the endpoint also filters `is_read=False`, but
            // skipping read rows keeps the payload small and lets us
            // short-circuit when nothing is unread.
            const targetIds = new Set(filteredActivities.flatMap(getAggregatedIds));
            const unreadIds = useCM.activityMessages
                .filter((a) => targetIds.has(a.activityId) && a.isRead === false)
                .map((a) => a.activityId);
            if (unreadIds.length === 0) {
                return;
            }
            const unreadIdSet = new Set(unreadIds);
            void (async () => {
                try {
                    // `activityId` is the v3 Activity UUID — the same value the
                    // per-row `/activities/{id}/read/` endpoint keys on. Hits
                    // the Django host directly (not authApi — its baseURL ends
                    // in /api/v2/).
                    await axios.put(
                        `${v3ApiBaseURL()}/api/v3/activities/read-batch/`,
                        { activity_ids: unreadIds },
                        {
                            headers: { Authorization: `Bearer ${accessToken}` },
                            withCredentials: true,
                        }
                    );
                    const affected: ActivityMessageProps[] = [];
                    const updated = useCM.activityMessages.map((a) => {
                        if (unreadIdSet.has(a.activityId) && a.isRead === false) {
                            const next = { ...a, isRead: true };
                            affected.push(next);
                            return next;
                        }
                        return a;
                    });
                    if (affected.length > 0) {
                        await new ActivityService().batchInsertActivityMessages(affected);
                    }
                    useCM.setActivityMessages(updated);
                    // Keep the Activity-tab unread badge in sync — it's
                    // independent state (not derived from `activityMessages`),
                    // so flipping rows alone would leave it stale. Mirrors
                    // `countUnreadActivityMessages` (unread-TOPIC count, in
                    // the same aggregated units the feed renders).
                    useCM.setUnReadActivityMessageCounts(countUnreadActivityTopics(updated));
                } catch (error: unknown) {
                    if (axios.isAxiosError(error)) {
                        console.error(
                            "markFilteredActivityAsRead API error:",
                            error.response?.status,
                            error.response?.data
                        );
                    } else {
                        console.error("markFilteredActivityAsRead error:", error);
                    }
                }
            })();
        },
        [accessToken, useCM]
    );

    return { markFilteredAsRead };
};
