import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { CustomTaskTemplate } from "../utils/taskTemplates";

// Fetch a project's custom body templates (the create-form picker shows
// these alongside the built-in defaults). Mirrors `loadProjectTags`.
export const loadProjectTaskTemplates = async (
    myself: UserProps,
    projectId: number,
    accessToken: string | null
): Promise<CustomTaskTemplate[]> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const query = `team_id=${myself.teamId}&project_id=${projectId}`;
            const res = await api.get(`/project/task-template/?${query}`);
            return res.data as CustomTaskTemplate[];
        } else {
            console.error("Unauthorized. Auth token is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return [];
};
