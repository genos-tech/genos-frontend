import { useCallback } from "react";
import axios from "axios";

import { useAuth } from "../../../context/AuthContext";
import { ActivityService } from "../../../db/services";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { v3ApiBaseURL } from "../../../services/v3Api";
import { UserProps } from "../../../types/admin";
import { ActivityMessageProps } from "../../../types/chat";

interface UseMarkAllChatActivityReadProps {
    // Kept for call-site API stability; identity comes from the token.
    myself: UserProps;
    useCM: ChatManagementState;
}

interface UseMarkAllChatActivityReadResult {
    markAllAsRead: (chatType: number, chatId: number) => void;
}

/**
 * Mark all activity for one chat as read.
 *
 * PUTs the v3 `/api/v3/activities/read-all/?channel_id=` endpoint,
 * optimistically flips the matching rows in `useCM.activityMessages`,
 * and persists the affected rows to the activity IDB store.
 *
 * Previously this hopped through the `chatChannel` web worker, whose only
 * remaining job was this exact call — pure overhead now that the endpoint
 * is v3-native. Inlined here so the `chatChannel` worker can be retired;
 * the rest of the activity feed runs on the separate `activityChannel`.
 */
export const useMarkAllChatActivityRead = ({
    useCM,
}: UseMarkAllChatActivityReadProps): UseMarkAllChatActivityReadResult => {
    const { accessToken } = useAuth();

    const markAllAsRead = useCallback(
        (chatType: number, chatId: number) => {
            if (!accessToken) {
                console.error("Cannot mark all as read: missing access token.");
                return;
            }
            void (async () => {
                try {
                    // Channel id is the v3 UUID carried through the legacy
                    // `chatId: number` slot. The endpoint scopes by the
                    // `channel_id` query param. Hits the Django host
                    // directly (not authApi — its baseURL ends in /api/v2/).
                    await axios.put(
                        `${v3ApiBaseURL()}/api/v3/activities/read-all/?channel_id=${encodeURIComponent(
                            String(chatId)
                        )}`,
                        {},
                        {
                            headers: { Authorization: `Bearer ${accessToken}` },
                            withCredentials: true,
                        }
                    );
                    const affected: ActivityMessageProps[] = [];
                    const updated = useCM.activityMessages.map((a) => {
                        if (a.chatType === chatType && a.chatId === chatId && a.isRead === false) {
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
                } catch (error: unknown) {
                    if (axios.isAxiosError(error)) {
                        console.error(
                            "markAllChatActivityAsRead API error:",
                            error.response?.status,
                            error.response?.data
                        );
                    } else {
                        console.error("markAllChatActivityAsRead error:", error);
                    }
                }
            })();
        },
        [accessToken, useCM]
    );

    return { markAllAsRead };
};
