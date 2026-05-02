import axios from "axios";

import { authApi } from "../../../../services/api";
import { ProjectSprintsResponse } from "../types";

export type LoadProjectSprintsOptions = {
    statuses?: string[];
    includePast?: boolean;
    from?: string;
};

export const loadProjectSprints = async (
    projectId: number,
    accessToken: string | null,
    opts?: LoadProjectSprintsOptions
): Promise<ProjectSprintsResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const params = new URLSearchParams();
            params.set("project_id", String(projectId));
            if (opts?.statuses && opts.statuses.length > 0) {
                params.set("statuses", opts.statuses.join(","));
            }
            if (opts?.includePast === false) {
                params.set("include_past", "false");
            }
            if (opts?.from) {
                params.set("from", opts.from);
            }
            const res = await api.get(`/sprint/list/?${params.toString()}`);
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
