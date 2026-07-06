import axios from "axios";

import { authApi } from "../../../../services/api";
import { createRequestCache } from "../../../../services/requestCache";
import { UserProps } from "../../../../types/admin";
import { TaskNoteProps } from "../../../../types/notes";

// Dedup-only (ttlMs 0): the caller effects refetch when
// `useNM.taskNoteMeta` changes, and that signal carries no task-scoped
// event we could invalidate on — a TTL here would serve a stale list
// at exactly the moment a refresh was requested. Concurrent duplicate
// GETs (preview-switch bursts, StrictMode double-effects) still
// collapse into one request.
const taskNotesCache = createRequestCache<TaskNoteProps[] | undefined>({ ttlMs: 0 });

export const loadTaskNotes = async (
    myself: UserProps,
    projectId: number,
    taskId: number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const cacheKey = `notes:${taskId}:${myself.teamId}:${projectId}`;
            return await taskNotesCache.get(cacheKey, async () => {
                const query: string = `team_id=${myself.teamId}&project_id=${projectId}&task_id=${taskId}`;
                const res = await api.get(`/note/task/?${query}`);
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
