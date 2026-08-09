import axios from "axios";

import { authApi } from "../../../services/api";
import { InboxItemProps } from "../../../types/common";

// Wire shape mirrors the backend's delta envelope; `isDeleted` is only
// present on incremental responses (rows the client should evict).
export interface InboxDeltaItem extends InboxItemProps {
    isDeleted?: boolean;
}

export interface InboxDeltaResponse {
    serverTime: string;
    items: InboxDeltaItem[];
    forceFull?: boolean;
}

export const loadInbox = async (
    teamId: string,
    userId: string,
    accessToken: string | null,
    since: string | null
): Promise<InboxDeltaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Authentication token was not found.");
            return;
        }
        const params: string[] = [`team_id=${teamId}`, `user_id=${userId}`];
        if (since) {
            params.push(`since=${encodeURIComponent(since)}`);
        }
        const res = await api.get(`/inbox/?${params.join("&")}`);
        return {
            serverTime: res.data.server_time,
            items: res.data.data.items,
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
