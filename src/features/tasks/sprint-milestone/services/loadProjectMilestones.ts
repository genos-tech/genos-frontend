import axios from "axios";

import { authApi } from "../../../../services/api";
import { ProjectMilestonesResponse } from "../types";

export type LoadProjectMilestonesOptions = {
    statuses?: string[];
    sprintId?: number | "null" | null;
};

export const loadProjectMilestones = async (
    projectId: number,
    accessToken: string | null,
    opts?: LoadProjectMilestonesOptions
): Promise<ProjectMilestonesResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const params = new URLSearchParams();
            params.set("project_id", String(projectId));
            if (opts?.statuses && opts.statuses.length > 0) {
                params.set("statuses", opts.statuses.join(","));
            }
            if (opts?.sprintId !== undefined && opts.sprintId !== null) {
                params.set("sprint_id", String(opts.sprintId));
            }
            const res = await api.get(`/milestone/list/?${params.toString()}`);
            return res.data;
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
