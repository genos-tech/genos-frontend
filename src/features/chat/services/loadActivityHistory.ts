import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { ActivityMessageProps } from "../../../types/chat";

// Default lookback for the FULL-load path. Once a checkpoint exists,
// the server uses it as the lower bound instead — no day cap applies.
const periodDays: number = 30;

export interface ActivityDeltaResponse {
    serverTime: string;
    activity: ActivityMessageProps[];
}

export const loadActivityHistory = async (
    myself: UserProps,
    accessToken: string | null,
    since: string | null
): Promise<ActivityDeltaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth toke is not found.");
            return;
        }
        const params: string[] = [`team_id=${myself.teamId}`, `user_id=${myself.userId}`];
        if (since) {
            params.push(`since=${encodeURIComponent(since)}`);
        } else {
            params.push(`period_days=${periodDays}`);
        }
        const res = await api.get(`/chat/activity/history/?${params.join("&")}`);
        return {
            serverTime: res.data.server_time,
            activity: res.data.data.activity,
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
