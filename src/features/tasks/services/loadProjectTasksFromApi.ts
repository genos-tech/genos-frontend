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
    /**
     * The sum of the task ids the store should hold, 0 for an empty
     * project. A count cannot see one stale row plus one missing row; the
     * sum can. Absent on a full answer and on an API that predates it, in
     * which case the caller compares the count alone.
     */
    idSum?: number;
}

// Direct API call to `getProjectTasks`. Used by `loadProjectTasksWorker`
// to populate IndexedDB; main-thread callers should go through
// `loadProjectTasks` (the worker wrapper, which also dedupes in-flight
// requests) instead of calling this directly.
//
// `failure.status` (optional out-parameter) receives the HTTP status of a failed
// request, so the worker can tell "this project is gone for you" (404 / 403)
// from "the server is down" without changing what callers get back (`undefined`).
export const loadProjectTasksFromApi = async (
    myself: UserProps,
    projectId: number,
    accessToken: string | null,
    since: string | null,
    failure?: { status?: number }
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
            idSum: res.data.data.idSum,
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            if (failure) failure.status = error.response?.status;
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};

// The worker's rejection reaches the main thread as a bare message, so the HTTP
// status rides in it: "Failed to load project tasks (HTTP 404)".
export const projectTasksFailureMessage = (status: number | undefined): string =>
    status ? `Failed to load project tasks (HTTP ${status})` : "Failed to load project tasks";

/** The project no longer exists for this user (deleted, left, access lost: the API
 *  answers 404 "Project not found" to a non-member): the load can never succeed, so it is
 *  not a failure to sync (MIP-1323). Only 404: a 403 is an auth problem that can heal. */
export const isProjectGoneError = (err: unknown): boolean =>
    err instanceof Error && /\(HTTP 404\)/.test(err.message);
