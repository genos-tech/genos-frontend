import axios from "axios";

import { authApi } from "../../../services/api";

export const loadGMProfile = async (teamId: string, gmId: number, accessToken: string | null) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${teamId}&gm_id=${gmId}`;
            const res = await api.get(`/gm/profile/?${query}`);
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
