import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { SearchTeamTasksResponse } from "../../../types/tasks";

// The task sidebar's Recents (MIP-1063): the tasks THIS user opened, newest
// open first, at most 20 per project. Private to the caller; the server
// re-checks project access on every read.

/**
 * The caller's recently opened tasks. Resolves to `undefined` when the request
 * fails, so a caller can keep the list it has instead of blanking it.
 */
export const loadRecentTasks = async (
    myself: UserProps,
    accessToken: string | null
): Promise<SearchTeamTasksResponse[] | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return undefined;
        const res = await api.get("/task/recent/", { params: { team_id: myself.teamId } });
        return Array.isArray(res.data) ? res.data : undefined;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("loadRecentTasks error:", error.response?.status, error.response?.data);
        } else {
            console.error("loadRecentTasks error:", error);
        }
        return undefined;
    }
};

/**
 * Tell the server the user is looking at a task. True once it is recorded.
 *
 * A 404 (a draft that is not a real task yet, a task the user can no longer
 * open) is an answer, not a failure: nothing to record, nothing to log.
 */
export const recordTaskOpen = async (
    taskId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.post("/task/recent/open/", { task_id: taskId });
        return true;
    } catch (error: unknown) {
        if (axios.isAxiosError(error) && error.response?.status === 404) return false;
        console.error("recordTaskOpen error:", error);
        return false;
    }
};
