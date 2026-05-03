import { useCallback, useEffect, useRef } from "react";

import { useAuth } from "../../../context/AuthContext";
import MarkAllChatActivityAsReadWorker from "../../../db/workers/markAllChatActivityAsReadWorker.ts?worker";
import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { UserProps } from "../../../types/admin";
import { ActivityMessageProps } from "../../../types/chat";

interface UseMarkAllChatActivityReadProps {
    myself: UserProps;
    useCM: ChatManagementState;
}

interface UseMarkAllChatActivityReadResult {
    markAllAsRead: (chatType: number, chatId: number) => void;
}

/**
 * Owns a single worker per `markAllAsRead` call: spawns the worker, waits for
 * the bulk PUT + IDB upsert to finish, then writes the returned activity list
 * into `useCM.activityMessages` so the UI re-renders without an extra fetch.
 *
 * Tracks every spawned worker in a ref so the parent component unmounting
 * mid-flight doesn't leak (or fire onmessage into a torn-down React tree).
 */
export const useMarkAllChatActivityRead = ({
    myself,
    useCM,
}: UseMarkAllChatActivityReadProps): UseMarkAllChatActivityReadResult => {
    const { accessToken } = useAuth();
    const workersRef = useRef<Set<Worker>>(new Set());

    useEffect(() => {
        const workers = workersRef.current;
        return () => {
            workers.forEach((w) => w.terminate());
            workers.clear();
        };
    }, []);

    const markAllAsRead = useCallback(
        (chatType: number, chatId: number) => {
            if (!accessToken) {
                console.error("Cannot mark all as read: missing access token.");
                return;
            }

            const worker = new MarkAllChatActivityAsReadWorker();
            workersRef.current.add(worker);

            worker.postMessage({
                accessToken,
                myself,
                chatType,
                chatId,
                activityMessages: useCM.activityMessages,
            });

            worker.onmessage = (event) => {
                const data = event.data as ActivityMessageProps[] | { error: string };
                if (Array.isArray(data)) {
                    useCM.setActivityMessages(data);
                } else if (data?.error) {
                    console.error("markAllChatActivityAsRead worker failed:", data.error);
                }
                workersRef.current.delete(worker);
                worker.terminate();
            };

            worker.onerror = (err) => {
                console.error("markAllChatActivityAsRead worker error:", err);
                workersRef.current.delete(worker);
                worker.terminate();
            };
        },
        [accessToken, myself, useCM]
    );

    return { markAllAsRead };
};
