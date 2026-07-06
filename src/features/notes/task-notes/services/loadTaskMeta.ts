import axios from "axios";

import { authApi } from "../../../../services/api";
import { createRequestCache } from "../../../../services/requestCache";
import { UserProps } from "../../../../types/admin";
import { TaskMetaProps } from "../../../../types/tasks";

// Short-TTL cache + in-flight dedup. `getTaskMeta()` is called on
// every cycle of the tmpCurrentTaskContent mirror loop (once per
// autosave/preview-sync pass), which showed up as 7+ identical
// /task/meta/ fetches per session — 4.5 kB each, queueing behind
// other traffic. The payload is team-wide task metadata whose
// consumers (note pickers, nav lists) tolerate a few seconds of
// staleness; deliberately NO event-based invalidation, because the
// mirror loop fires exactly when tasks change and would defeat the
// cache.
const taskMetaCache = createRequestCache<TaskMetaProps[]>({ ttlMs: 10_000 });

// Resolves to `[]` on any failure so callers can gate on `length`
// without an undefined check — the `getTaskMeta` consumer keeps its
// previous meta when the fetch comes back empty.
export const loadTaskMeta = async (
    myself: UserProps,
    accessToken: string | null
): Promise<TaskMetaProps[]> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth toke is not found.");
            return [];
        }
        const cacheKey = `taskmeta:${myself.teamId}:${myself.userId}`;
        return await taskMetaCache.get(cacheKey, async () => {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/task/meta/?${query}`);
            return Array.isArray(res.data) ? (res.data as TaskMetaProps[]) : [];
        });
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        return [];
    }
};
