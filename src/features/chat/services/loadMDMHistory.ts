import axios from "axios";

import { authApi } from "../../../services/api";

export const loadMDMHistory = async (
    teamId: string,
    teamName: string,
    userId: string,
    accessToken: string | null,
    mdmId?: number
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const params: Record<string, string | number> = {
                team_id: teamId,
                team_name: teamName,
                user_id: userId,
            };
            if (mdmId) {
                params.mdm_id = mdmId;
            }
            const res = await api.get("/mdm/history/", { params });
            return res.data;
        } else {
            console.error("Unauthorized. Auth token is not found.");
            return { chat_history: [], flagged_messages: [] };
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        return { chat_history: [], flagged_messages: [] };
    }
};
