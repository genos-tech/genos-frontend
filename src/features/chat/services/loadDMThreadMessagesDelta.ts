import axios from "axios";

import { authApi } from "../../../services/api";
import { ThreadMessageProps } from "../../../types/chat";

export interface DMThreadMessageDeltaItem extends ThreadMessageProps {
    isDeleted?: boolean;
}

export interface DMThreadMessagesDeltaResponse {
    serverTime: string;
    thread_messages: DMThreadMessageDeltaItem[];
    forceFull?: boolean;
}

export const loadDMThreadMessagesDelta = async (
    teamId: string,
    userId: string,
    accessToken: string | null,
    since: string | null
): Promise<DMThreadMessagesDeltaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth toke is not found.");
            return;
        }
        const params: string[] = [`team_id=${teamId}`, `user_id=${userId}`];
        if (since) {
            params.push(`since=${encodeURIComponent(since)}`);
        }
        const res = await api.get(`/dm/threadMessagesDelta/?${params.join("&")}`);
        return {
            serverTime: res.data.server_time,
            thread_messages: res.data.data.thread_messages,
            forceFull: res.data.force_full_reload,
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
