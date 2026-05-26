import axios from "axios";

import { invalidateCachedFullTask } from "../../../db/services/task-full.service";
import { authApi } from "../../../services/api";

export const deleteTaskAttachment = async (
    taskId: number,
    attachmentId: number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `task=${taskId}&attachment_id=${attachmentId}`;
            const res = await api.delete(`/task/attachment/?${query}`);
            // Invalidate the full-task IDB cache so the next
            // `loadSpecificTask` refetches from the server. Without
            // this, reopening the task surfaces the just-deleted
            // attachment from the stale cache row and the subsequent
            // re-delete attempt 404s (the row is already gone
            // server-side).
            await invalidateCachedFullTask(taskId);
            return res;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
