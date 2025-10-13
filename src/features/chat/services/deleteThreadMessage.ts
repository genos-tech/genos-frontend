import axios from "axios";

import { authApi } from "../../../services/api";

export const deleteThreadMessage = async (
    accessToken: string | null,
    chatType: number,
    chatId: number,
    threadId: number,
    messageId: number,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            if (chatType === 1) {
                const res = await api.put("/dm/threadMessage/", {
                    dm_id: chatId,
                    thread_id: threadId,
                    message_id: messageId,
                    is_deleted: true,
                });
                return res.data;
            } else if (chatType === 2) {
                const res = await api.put("/gm/threadMessage/", {
                    gm_id: chatId,
                    thread_id: threadId,
                    message_id: messageId,
                    is_deleted: true,
                });
                return res.data;
            } else if (chatType === 3) {
                const res = await api.put("/pm/threadMessage/", {
                    project_id: chatId,
                    thread_id: threadId,
                    message_id: messageId,
                    is_deleted: true,
                });
                return res.data;
            } else {
                console.error("Unexpected chat type:", chatType);
            }
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
