import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

// Re-anchor a task note (and, server-side, its whole descendant
// subtree) to a different task. The backend derives the project from
// the target task and refreshes the notes' search-index ACL. Returns
// the enriched meta-shaped row (taskTitle/projectName/displayId/…) on
// success, undefined on failure.
export const moveTaskNote = async (
    myself: UserProps,
    noteId: number,
    taskId: number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/note/task/move/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                note_id: noteId,
                task_id: taskId,
            });
            return res.data;
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
    return undefined;
};
