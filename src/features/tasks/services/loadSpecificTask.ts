import axios from "axios";

import { cacheFullTask, getCachedFullTask } from "../../../db/services/task-full.service";
import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";

// Defensive scrub for stale cache entries: strip any negative-id
// "in-flight" attachment that leaked into IDB before the
// `sendUpdatedSpecificTask` cache write started filtering them out.
// Without this, a stale negative-id row would resurrect on every load
// and the next save would re-POST it (creating a duplicate file on
// the server every drop until the cache entry is naturally evicted).
const scrubInFlightAttachments = (task: TaskProps): TaskProps => ({
    ...task,
    attachments: (task.attachments ?? []).filter((a) => a.attachment_id >= 0),
});

export const loadSpecificTask = async (
    myself: UserProps,
    projectId: number,
    taskId: number,
    accessToken: string | null,
    options?: { forceRefresh?: boolean }
) => {
    try {
        if (!options?.forceRefresh) {
            const cached = await getCachedFullTask(taskId);
            if (cached) {
                return [scrubInFlightAttachments(cached)];
            }
        }

        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&project_id=${projectId}&task_id=${taskId}`;
            const res = await api.get(`/task/getTask/?${query}`);
            const data = res.data;
            if (Array.isArray(data) && data[0]) {
                await cacheFullTask(data[0] as TaskProps);
            }
            return data;
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
