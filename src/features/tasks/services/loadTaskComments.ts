import axios from "axios";

import { authApi } from "../../../services/api";
import { createRequestCache } from "../../../services/requestCache";
import { UserProps } from "../../../types/admin";
import { TaskCommentProps } from "../../../types/tasks";
import { onTaskTouched } from "./taskEvents";

// Local posts/edits and socket broadcasts all emit a scoped "comment"
// event, so the TTL only covers signal gaps; dedup absorbs the
// preview-switch bursts where the same list was fetched several times.
const commentsCache = createRequestCache<TaskCommentProps[] | undefined>({ ttlMs: 15_000 });
onTaskTouched(({ taskId, kind }) => {
    if (kind === "comment") {
        commentsCache.invalidate(`comments:${taskId}:`);
    }
});

export const loadTaskComments = async (
    myself: UserProps,
    taskId: number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const cacheKey = `comments:${taskId}:${myself.userId}`;
            return await commentsCache.get(cacheKey, async () => {
                const query: string = `user_id=${myself.userId}&task_id=${taskId}`;
                const res = await api.get(`/task/comment/?${query}`);
                return res.data;
            });
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
