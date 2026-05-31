import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { isLegacyNumericId } from "../../../utils/legacyId";

export const loadSpecificTaskByThreadId = async (
    myself: UserProps,
    chatType: number,
    chatId: number,
    threadId: number,
    accessToken: string | null
) => {
    // PUNCH LIST (v3 chatId migration): `/task/getTaskByThreadId/`
    // binds `chat_id` to an integer field. Short-circuit when the id
    // is a v3 UUID — v3 thread → task resolution belongs in the v3
    // channel sync path.
    if (!isLegacyNumericId(chatId)) {
        return [];
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&chat_type=${chatType}&chat_id=${chatId}&thread_id=${threadId}`;
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
