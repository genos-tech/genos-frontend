import axios from "axios";

import { authApi } from "../../../services/api";
import { createRequestCache } from "../../../services/requestCache";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { onTaskTouched } from "./taskEvents";

// Child lists change rarely (subtask create / status / reparent), and
// the local mutation paths emit a scoped "children" event, so a 30s
// TTL only risks staleness from other clients between socket gaps.
const childTasksCache = createRequestCache<TaskProps[] | undefined>({ ttlMs: 30_000 });
onTaskTouched(({ taskId, kind }) => {
    if (kind === "children") {
        childTasksCache.invalidate(`children:${taskId}:`);
    }
});

export const loadSpecificChildTasks = async (
    myself: UserProps,
    projectId: number,
    currentTaskId: number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const cacheKey = `children:${currentTaskId}:${myself.teamId}:${projectId}`;
            return await childTasksCache.get(cacheKey, async () => {
                const query: string = `team_id=${myself.teamId}&project_id=${projectId}&current_task_id=${currentTaskId}`;
                const res = await api.get(`/task/childTasks/?${query}`);
                return res.data;
            });
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
