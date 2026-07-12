import axios from "axios";

import { authApi } from "../../../services/api";
import { createRequestCache } from "../../../services/requestCache";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { onTaskTouched } from "./taskEvents";

// Child lists change rarely (subtask create / status / reparent), and
// the local mutation paths emit a scoped "children" event, so a 30s
// TTL only risks staleness from other clients between socket gaps.
const childTasksCache = createRequestCache<TaskProps[] | undefined>({ ttlMs: 30_000 });
onTaskTouched(({ taskId, kind }) => {
    if (kind === "children") {
        // This task's own child list changed (subtask add / move / reparent).
        childTasksCache.invalidate(`children:${taskId}:`);
        return;
    }
    if (kind === "update") {
        // A task's fields (status, title, assignee…) changed. That task
        // may be a subtask inside ANY cached parent's list, and the event
        // only carries the changed task's id — not its parent — so we
        // can't target one entry. Drop every cached child list; they're
        // small and "update" is user-initiated, so this won't reintroduce
        // the refetch storm the cache guards against (rapid read-only
        // click-through, during which no updates fire). Without this, a
        // subtask's new status stays stale in the parent's Sub Tasks block
        // for up to the 30s TTL after editing it.
        childTasksCache.invalidate("children:");
    }
});

export const loadSpecificChildTasks = async (
    myself: UserProps,
    projectId: number,
    currentTaskId: number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const cacheKey = `children:${currentTaskId}:${myself.teamId}:${projectId}`;
            return await childTasksCache.get(cacheKey, async () => {
                const query: string = `team_id=${myself.teamId}&project_id=${projectId}&current_task_id=${currentTaskId}`;
                const res = await api.get(`/task/childTasks/?${query}`);
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
