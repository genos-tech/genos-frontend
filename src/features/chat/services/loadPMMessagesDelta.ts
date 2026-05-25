import axios from "axios";

import { authApi } from "../../../services/api";
import { MessageProps } from "../../../types/chat";

export interface PMMessageDeltaItem extends MessageProps {
    isDeleted?: boolean;
}

export interface PMMessagesDeltaResponse {
    serverTime: string;
    messages: PMMessageDeltaItem[];
    forceFull?: boolean;
}

export const loadPMMessagesDelta = async (
    teamId: string,
    userId: string,
    accessToken: string | null,
    since: string | null
): Promise<PMMessagesDeltaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth toke is not found.");
            return;
        }
        const params: string[] = [`team_id=${teamId}`, `user_id=${userId}`];
        if (since) params.push(`since=${encodeURIComponent(since)}`);
        const res = await api.get(`/pm/messagesDelta/?${params.join("&")}`);
        return {
            serverTime: res.data.server_time,
            messages: res.data.data.messages,
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
