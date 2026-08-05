import axios from "axios";

import { authApi } from "../../../services/api";
import { createRequestCache } from "../../../services/requestCache";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { onTasksBulkChanged, onTaskTouched } from "./taskEvents";

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
onTasksBulkChanged(() => {
    // A project move rewrites the project of a whole sub-tree — a
    // milestone's move carries every task filed under it — and entries
    // here are keyed per (parent, project). One of those entries is
    // actively wrong by the time this fires: the picker switches the
    // preview's project OPTIMISTICALLY, so the sub-task block refetches
    // under the DESTINATION project id while the server still has the
    // children in the source, and caches the empty list that comes back.
    // Nothing else clears it — a move is not describable as
    // `genos:task-touched`, which names one task — so the block read "no
    // sub-tasks" from cache through every remount, and only a page reload
    // (which takes this module with it) appeared to fix it. The event
    // names a project, not the parents whose lists changed, so drop them
    // all and let the mounted blocks ask again.
    childTasksCache.invalidate("children:");
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
