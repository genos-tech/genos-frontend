import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

export const loadMyNoteMeta = async (myself: UserProps, accessToken: string | null) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/note/personal/meta/?${query}`);
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
