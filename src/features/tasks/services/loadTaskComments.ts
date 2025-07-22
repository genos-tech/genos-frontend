import axios from "axios";

import { authApi } from "../../../services/api";

export const loadTaskComments = async (taskId: number, accessToken: string | null) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `task_id=${taskId}`;
            const res = await api.get(`/task/comment/?${query}`);
            return res.data;
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
