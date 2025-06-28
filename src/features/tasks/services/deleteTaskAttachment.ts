import axios from "axios";

import { authApi } from "../../../services/api";

export const deleteTaskAttachment = async (
    taskId: string,
    attachmentId: number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `task=${taskId}&attachment_id=${attachmentId}`;
            const res = await api.delete(`/task/attachment/?${query}`);
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
