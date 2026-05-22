import axios from "axios";

import { authApi } from "../../../../services/api";

/**
 * Minimal PATCH-like helper for the diagram. The backend's
 * `TaskMasterView.put` already strips `None` from the incoming
 * payload, so we just include the fields we want to change and pass
 * `task_id`. Avoids forcing the diagram to assemble a full
 * `TaskProps` (it only has `TaskTableProps`-shaped data on hand).
 *
 * Used for: rename, set start/due date, re-parent (via parent_task_id).
 */
export type TaskPatchPayload = {
    title?: string;
    start_date?: string | null;
    due_date?: string | null;
    parent_task_id?: number | null;
    // milestone is explicitly nullable on the backend; surface it so
    // re-parenting across a milestone boundary works.
    milestone?: number | null;
};

export const patchTaskFields = async (
    taskId: number,
    patch: TaskPatchPayload,
    accessToken: string | null
): Promise<{ ok: boolean; error?: string }> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, error: "Unauthorized." };
        await api.put("/task/", { task_id: taskId, ...patch });
        return { ok: true };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            const msg =
                (error.response?.data as { error?: string } | undefined)?.error ??
                "Failed to update task.";
            return { ok: false, error: msg };
        }
        return { ok: false, error: "Unexpected error." };
    }
};
