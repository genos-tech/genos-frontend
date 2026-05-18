import { useCallback } from "react";

import { useAuth } from "../../../context/AuthContext";
import { chatChannel } from "../../../db/workers/channels";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";

interface UseMarkAllChatActivityReadProps {
    myself: UserProps;
    useCM: ChatManagementState;
}

interface UseMarkAllChatActivityReadResult {
    markAllAsRead: (chatType: number, chatId: number) => void;
}

/**
 * Fires a "markAllChatActivityAsRead" request over the shared chat worker
 * channel: the worker performs the bulk PUT + IDB upsert and returns the
 * updated activity list, which we write back into `useCM.activityMessages`.
 *
 * The channel is a long-lived singleton so no per-call setup/teardown is
 * required here; ignoring the promise on unmount is safe because the
 * channel handles its own lifecycle.
 */
export const useMarkAllChatActivityRead = ({
    myself,
    useCM,
}: UseMarkAllChatActivityReadProps): UseMarkAllChatActivityReadResult => {
    const { accessToken } = useAuth();

    const markAllAsRead = useCallback(
        (chatType: number, chatId: number) => {
            if (!accessToken) {
                console.error("Cannot mark all as read: missing access token.");
                return;
            }
            chatChannel
                .request("markAllChatActivityAsRead", {
                    accessToken,
                    myself,
                    chatType,
                    chatId,
                    activityMessages: useCM.activityMessages,
                })
                .then((data) => {
                    if (Array.isArray(data)) {
                        useCM.setActivityMessages(data);
                    } else if (data && "error" in data) {
                        console.error("markAllChatActivityAsRead failed:", data.error);
                    }
                })
                .catch((err) => {
                    console.error("markAllChatActivityAsRead error:", err);
                });
        },
        [accessToken, myself, useCM]
    );

    return { markAllAsRead };
};
