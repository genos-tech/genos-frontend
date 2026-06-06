import { useCallback } from "react";
import axios from "axios";

import { useAuth } from "../../../context/AuthContext";
import { ActivityService } from "../../../db/services";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { v3ApiBaseURL } from "../../../services/v3Api";
import { ActivityMessageProps } from "../../../types/chat";

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
 * marks exactly the activities the caller passes in — the sidebar uses it to
 * clear the *currently-filtered* activity feed, a set that spans multiple
 * channels and channel-less surfaces (note mentions). It PUTs the unread
 * subset's ids to the v3 `/api/v3/activities/read-batch/` endpoint (which
 * requires a non-empty id list and so can never degrade into "mark
 * everything"), optimistically flips those rows in `useCM.activityMessages`,
 * and persists the affected rows to the activity IDB store.
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
            // Only the unread rows need flipping; the endpoint also filters
            // `is_read=False`, but skipping read rows keeps the payload small
            // and lets us short-circuit when nothing is unread.
            const unread = filteredActivities.filter((a) => a.isRead === false);
            if (unread.length === 0) {
                return;
            }
            const unreadIds = unread.map((a) => a.activityId);
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
                    // `countUnreadActivityMessages` (plain isRead===false count).
                    useCM.setUnReadActivityMessageCounts(
                        updated.reduce((acc, a) => (a.isRead === false ? acc + 1 : acc), 0)
                    );
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
