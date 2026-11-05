import axios from "axios";

import { authApi } from "../../../../services/api";
import { Milestone } from "../types";

/**
 * Converting a root task to a milestone and back (MIP-1042). A conversion keeps
 * the task row: the same id, display id, body and comments. Only the milestone
 * record is added or retired.
 */

/** The task row a conversion leaves behind. */
export type ConvertedTaskRef = {
    taskId: number;
    displayId: string;
    projectId: number;
    isMilestone: boolean;
    /** Set while the row is a milestone, null otherwise. */
    milestoneId: number | null;
};

export type ConvertFailure = {
    ok: false;
    /** HTTP status, or null when there was no response (offline). */
    status: number | null;
    /** The server's stable reason, e.g. `not_a_root_task`. */
    code: string | null;
    /** The server's sentence for a person. */
    message: string | null;
};

export type ConvertResult<T> = { ok: true; data: T } | ConvertFailure;

export type TaskToMilestoneResponse = { milestone: Milestone; task: ConvertedTaskRef };
export type MilestoneToTaskResponse = {
    task: ConvertedTaskRef;
    convertedMilestoneId: number;
    /** How many tasks stay under the row as sub-tasks. */
    subTasksKept: number;
};

/** What `GET /milestone/<id>/` answers (410) for a milestone that became a task. */
export const MILESTONE_CONVERTED_CODE = "milestone_converted_to_task";

const failure = (error: unknown): ConvertFailure => {
    if (axios.isAxiosError(error)) {
        const body = error.response?.data as { error?: unknown; code?: unknown } | undefined;
        return {
            ok: false,
            status: error.response?.status ?? null,
            code: typeof body?.code === "string" ? body.code : null,
            message: typeof body?.error === "string" ? body.error : null,
        };
    }
    return { ok: false, status: null, code: null, message: null };
};

// The caller shows the failure itself (the server's own sentence), so the shared
// "request failed" toast is switched off for these calls.
const post = async <T>(
    path: string,
    body: Record<string, unknown>,
    accessToken: string | null
): Promise<ConvertResult<T>> => {
    const api = authApi(accessToken);
    if (!api) return { ok: false, status: 401, code: null, message: null };
    try {
        const res = await api.post<T>(path, body, { suppressErrorToast: true });
        return { ok: true, data: res.data };
    } catch (error) {
        return failure(error);
    }
};

export const convertTaskToMilestone = (
    taskId: number,
    accessToken: string | null
): Promise<ConvertResult<TaskToMilestoneResponse>> =>
    post("/task/convert-to-milestone/", { task_id: taskId }, accessToken);

export const convertMilestoneToTask = (
    milestoneId: number,
    accessToken: string | null
): Promise<ConvertResult<MilestoneToTaskResponse>> =>
    post("/milestone/convert-to-task/", { milestone_id: milestoneId }, accessToken);
