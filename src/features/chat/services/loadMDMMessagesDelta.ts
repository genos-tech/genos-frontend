import axios from "axios";

import { authApi } from "../../../services/api";
import { MessageProps } from "../../../types/chat";

export interface MDMMessageDeltaItem extends MessageProps {
    isDeleted?: boolean;
}

export interface MDMMessagesDeltaResponse {
    serverTime: string;
    messages: MDMMessageDeltaItem[];
    forceFull?: boolean;
}

export const loadMDMMessagesDelta = async (
    teamId: string,
    userId: string,
    accessToken: string | null,
    since: string | null
): Promise<MDMMessagesDeltaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth toke is not found.");
            return;
        }
        const params: string[] = [`team_id=${teamId}`, `user_id=${userId}`];
        if (since) params.push(`since=${encodeURIComponent(since)}`);
        const res = await api.get(`/mdm/messagesDelta/?${params.join("&")}`);
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
