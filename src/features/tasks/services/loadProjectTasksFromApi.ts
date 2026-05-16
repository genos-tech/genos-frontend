import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

// Direct API call to `getProjectTasks`. Used by `loadProjectTasksWorker`
// to populate IndexedDB; main-thread callers should go through
// `loadProjectTasks` (the worker wrapper, which also dedupes in-flight
// requests) instead of calling this directly.
export const loadProjectTasksFromApi = async (
    myself: UserProps,
    projectId: number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&project_id=${projectId}`;
            const res = await api.get(`/task/getProjectTasks/?${query}`);
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
