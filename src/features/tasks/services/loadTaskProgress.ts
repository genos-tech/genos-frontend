import axios from "axios";

import { authApi } from "../../../services/api";
import { createRequestCache } from "../../../services/requestCache";
import { TaskProgressPage } from "../../../types/tasks";
import { onCommentsResync } from "./taskEvents";

// Short-TTL cache + in-flight dedup, like `loadTaskActivities`. The task's own
// `lastProgressAt` is part of the key (the caller passes it as `version`): it moves
// whenever something under the task changes, so a change anywhere below gets a fresh
// read and never a cached page from before it.
const progressCache = createRequestCache<TaskProgressPage>({ ttlMs: 15_000 });
onCommentsResync(() => progressCache.clear());

/**
 * What changed at or under a task or milestone, newest first (MIP-1351):
 * `GET /task/progress/`. `minDepth: 1` leaves out the task's own changes, which
 * are in its own Activity feed.
 *
 * Resolves to `null` when the request FAILED, so the feed can offer Retry rather
 * than say nothing happened (the same contract as `loadTaskActivities`, MIP-1276).
 * A task with nothing under it resolves to an empty page.
 */
export const loadTaskProgress = async (
    accessToken: string | null,
    taskId: number,
    options: {
        cursor?: string | null;
        limit?: number;
        minDepth?: number;
        version?: string | null;
    } = {}
): Promise<TaskProgressPage | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("loadTaskProgress: no auth token");
            return null;
        }
        const params = new URLSearchParams({ task_id: String(taskId) });
        if (options.limit != null) params.set("limit", String(options.limit));
        if (options.minDepth != null) params.set("min_depth", String(options.minDepth));
        if (options.cursor) params.set("cursor", options.cursor);
        const cacheKey = `progress:${taskId}:${options.version ?? ""}:${options.minDepth ?? ""}:${options.limit ?? ""}:${options.cursor ?? ""}`;
        return await progressCache.get(cacheKey, async () => {
            const res = await api.get(`/task/progress/?${params.toString()}`);
            const data = res.data as Partial<TaskProgressPage> | null;
            return {
                entries: Array.isArray(data?.entries) ? data.entries : [],
                nextCursor: data?.nextCursor ?? null,
            };
        });
    } catch (error) {
        if (axios.isAxiosError(error)) {
            console.error(
                "loadTaskProgress API error:",
                error.response?.status,
                error.response?.data
            );
        } else {
            console.error("loadTaskProgress unexpected error:", error);
        }
        return null;
    }
};
