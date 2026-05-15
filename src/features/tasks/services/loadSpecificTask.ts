import axios from "axios";

import { cacheFullTask, getCachedFullTask } from "../../../db/services/task-full.service";
import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";

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
                return [cached];
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
