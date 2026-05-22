import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

/**
 * Delete a task from the diagram. The backend `TaskMasterView.delete`
 * expects `team_id`, `task_id`, and `is_init_task_boolean` as query
 * params; we always pass 0 for the latter because the diagram only
 * deals with persisted (non-init) tasks.
 */
export const deleteDiagramTask = async (
    myself: UserProps,
    taskId: number,
    accessToken: string | null
): Promise<{ ok: boolean; error?: string }> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, error: "Unauthorized." };
        await api.delete(
            `/task/?team_id=${myself.teamId}&task_id=${taskId}&is_init_task_boolean=0`
        );
        return { ok: true };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            return {
                ok: false,
                error:
                    (error.response?.data as { error?: string } | undefined)?.error ??
                    "Failed to delete task.",
            };
        }
        return { ok: false, error: "Unexpected error." };
    }
};
