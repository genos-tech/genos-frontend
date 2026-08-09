import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

export const loadTeamMemberInfo = async (
    myself: UserProps,
    targetUserId: string,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        const query: string = `team_id=${myself.teamId}&user_id=${targetUserId}`;
        if (api) {
            const res = await api.get(`/team/getTeamMemberInfo/?${query}`);
            return res.data;
        } else {
            console.error("Unauthorized. Authentication token was not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
