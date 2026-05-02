import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { TaskActivityProps } from "../../../types/tasks";

/**
 * Fetch the audit log for a single task in reverse chronological
 * order (newest first). Backs the new "Activity" tab in TaskTabBlock.
 *
 * Resolves to `[]` on any failure so the calling component can render
 * an empty state without an extra try/catch — failures are logged for
 * observability.
 */
export const loadTaskActivities = async (
    myself: UserProps,
    taskId: number,
    accessToken: string | null,
    options?: { limit?: number; offset?: number }
): Promise<TaskActivityProps[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("loadTaskActivities: no auth token");
            return [];
        }
        const params = new URLSearchParams({
            team_id: String(myself.teamId ?? ""),
            task_id: String(taskId),
        });
        if (options?.limit != null) params.set("limit", String(options.limit));
        if (options?.offset != null) params.set("offset", String(options.offset));
        const res = await api.get(`/task/activity/?${params.toString()}`);
        return Array.isArray(res.data) ? (res.data as TaskActivityProps[]) : [];
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "loadTaskActivities API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("loadTaskActivities unexpected error:", error);
        }
        return [];
    }
};
