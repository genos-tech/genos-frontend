import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

export const loadSpecificTaskByThreadId = async (
    myself: UserProps,
    chatType: number,
    chatId: number,
    threadId: number,
    accessToken: string | null
) => {
    const _chatType: string = chatType === 1 ? "dm" : "gm";
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&chat_type=${_chatType}&chat_id=${chatId}&thread_id=${threadId}`;
            const res = await api.get(`/task/getTaskByThreadId/?${query}`);
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
