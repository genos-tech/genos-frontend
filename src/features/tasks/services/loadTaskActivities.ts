import axios from "axios";

import { authApi } from "../../../services/api";
import { createRequestCache } from "../../../services/requestCache";
import { UserProps } from "../../../types/admin";
import { TaskActivityProps } from "../../../types/tasks";
import { onTaskTouched } from "./taskEvents";

// Short-TTL cache + in-flight dedup. The task id leads the key so a
// scoped `genos:task-touched` event can invalidate every variant
// (limit/offset) for that task with one prefix. TTL bounds staleness
// for changes no event covers (background jobs, other clients' edits
// between socket gaps); events cover the hot local paths.
const activityCache = createRequestCache<TaskActivityProps[]>({ ttlMs: 15_000 });
onTaskTouched(({ taskId, kind }) => {
    // Comments write an activity row too (comment_added).
    if (kind === "comment" || kind === "update") {
        activityCache.invalidate(`activity:${taskId}:`);
    }
});

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
        const cacheKey = `activity:${taskId}:${myself.teamId}:${options?.limit ?? ""}:${options?.offset ?? ""}`;
        return await activityCache.get(cacheKey, async () => {
            const res = await api.get(`/task/activity/?${params.toString()}`);
            return Array.isArray(res.data) ? (res.data as TaskActivityProps[]) : [];
        });
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
