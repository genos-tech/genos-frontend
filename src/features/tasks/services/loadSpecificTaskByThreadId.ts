import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";

/**
 * Resolve the task a chat thread was the origin of, by the linkage the
 * task row stores (`chat_type` / `chat_id` / `thread_id`).
 *
 * `chatId` / `threadId` are v3 UUIDs post-migration (the backend's
 * columns are opaque CharFields and match by exact string), but legacy
 * numeric ids still resolve for pre-v3 rows — pass through whichever
 * the caller holds. Returns [] when the thread has no live task.
 */
export const loadSpecificTaskByThreadId = async (
    myself: UserProps,
    chatType: number,
    chatId: string | number,
    threadId: string | number,
    accessToken: string | null
): Promise<TaskProps[]> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query =
                `team_id=${myself.teamId}&chat_type=${chatType}` +
                `&chat_id=${encodeURIComponent(String(chatId))}` +
                `&thread_id=${encodeURIComponent(String(threadId))}` +
                `&attachments=meta`;
            const res = await api.get(`/task/getTaskByThreadId/?${query}`);
            return Array.isArray(res.data) ? res.data : [];
        } else {
            console.error("Unauthorized. Auth token is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return [];
};
