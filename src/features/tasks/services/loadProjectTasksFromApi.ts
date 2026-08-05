import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TaskTableProps } from "../../../types/tasks";

// `isDeleted` is only present on incremental responses (rows the client
// should evict from its local task index).
export interface ProjectTaskDeltaItem extends TaskTableProps {
    isDeleted?: boolean;
}

export interface ProjectTasksDeltaResponse {
    serverTime: string;
    tasks: ProjectTaskDeltaItem[];
    forceFull?: boolean;
    /**
     * How many rows our store should hold for this project once the delta
     * above is applied. Present on incremental answers only — a full one
     * is its own count. Lets the caller notice it is missing rows a
     * changes-since request will never send it again.
     */
    totalCount?: number;
}

// Direct API call to `getProjectTasks`. Used by `loadProjectTasksWorker`
// to populate IndexedDB; main-thread callers should go through
// `loadProjectTasks` (the worker wrapper, which also dedupes in-flight
// requests) instead of calling this directly.
export const loadProjectTasksFromApi = async (
    myself: UserProps,
    projectId: number,
    accessToken: string | null,
    since: string | null
): Promise<ProjectTasksDeltaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth toke is not found.");
            return;
        }
        const params: string[] = [`team_id=${myself.teamId}`, `project_id=${projectId}`];
        if (since) {
            params.push(`since=${encodeURIComponent(since)}`);
        }
        const res = await api.get(`/task/getProjectTasks/?${params.join("&")}`);
        return {
            serverTime: res.data.server_time,
            tasks: res.data.data.tasks,
            forceFull: res.data.force_full_reload,
            totalCount: res.data.data.totalCount,
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
