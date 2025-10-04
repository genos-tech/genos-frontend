import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

export const loadTeamTaskList = async (
    myself: UserProps,
    projectId: number,
    statuses: string,
    topN: number,
    accessToken: string | null,
    includeAll?: boolean
) => {
    try {
        const api = authApi(accessToken);
        const _includeAll = includeAll === true ? true : false;
        if (api) {
            const query: string = `team_id=${myself.teamId}&project_id=${projectId}&statuses=${statuses}&top_n=${topN}&include_all=${_includeAll}`;
            const res = await api.get(`/search/teamTasks/?${query}`);
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
