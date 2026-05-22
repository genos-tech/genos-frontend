import axios from "axios";

import { authApi } from "../../../services/api";
import { TaskDependencyRef } from "../../../types/tasks";

export type CreateTaskDependencyResult =
    | { ok: true; ref: TaskDependencyRef }
    | { ok: false; error: string };

export const createTaskDependency = async (
    blockerTaskId: number,
    blockedTaskId: number,
    accessToken: string | null
): Promise<CreateTaskDependencyResult> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            return { ok: false, error: "Unauthorized." };
        }
        const res = await api.post(`/task/dependency/`, {
            blocker_task_id: blockerTaskId,
            blocked_task_id: blockedTaskId,
        });
        return { ok: true, ref: res.data as TaskDependencyRef };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const msg =
                (error.response?.data as { error?: string } | undefined)?.error ??
                "Failed to create dependency.";
            return { ok: false, error: msg };
        }
        return { ok: false, error: "Unexpected error." };
    }
};
