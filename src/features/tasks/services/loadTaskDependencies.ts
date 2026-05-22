import axios from "axios";

import { authApi } from "../../../services/api";
import { TaskDependencies } from "../../../types/tasks";

export const loadTaskDependencies = async (
    taskId: number,
    accessToken: string | null
): Promise<TaskDependencies | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth token is not found.");
            return undefined;
        }
        const res = await api.get(`/task/dependency/list/?task_id=${taskId}`);
        const data = res.data;
        return {
            blocking: Array.isArray(data?.blocking) ? data.blocking : [],
            blockedBy: Array.isArray(data?.blockedBy) ? data.blockedBy : [],
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        return undefined;
    }
};
