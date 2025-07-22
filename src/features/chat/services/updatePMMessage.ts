import axios from "axios";

import { authApi } from "../../../services/api";

export const updatePMMessage = async (
    accessToken: string | null,
    projectId: number,
    taskId: number | null,
    messageId: number | null,
    messageBody: any[],
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/pm/message/", {
                project_id: projectId,
                task_id: taskId,
                message_id: messageId,
                message_body: messageBody,
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage("Unauthorized. Auth toke is not found.");
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (error.response?.status === 400) {
                console.error("HTTP 400 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("Failed to update PM message.");
                }
            } else if (error.response?.status === 401) {
                console.error("HTTP 401 error:", error.response?.data);
                if (setErrorMessage) {
                    setErrorMessage("Unauthorized. Please log in again.");
                }
            } else {
                console.error("API error:", error.response?.status, error.response?.data);
            }
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
