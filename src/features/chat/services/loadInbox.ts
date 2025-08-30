import axios from "axios";

import { authApi } from "../../../services/api";

export const loadInbox = async (
    teamId: string,
    userId: string,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${teamId}&user_id=${userId}`;
            const res = await api.get(`/inbox/?${query}`);
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
