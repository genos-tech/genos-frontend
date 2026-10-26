import axios from "axios";

import { authApi } from "../../../services/api";

export type RestoreTaskBodyResult = "ok" | "not-found" | "failed";

/**
 * Put back the description a task had before an agent, API-key or MCP rewrite
 * (MIP-738). `activityId` is the history row that kept the body.
 *
 * Three answers, because the screen says three different things: it worked, the
 * version is gone or isn't theirs (404, or a 400 for a row that kept nothing),
 * or something else went wrong (offline, a server error). Never throws.
 *
 * The server also pushes the restored body into the task's live editor
 * document, so an open editor updates by itself; the caller only has to refresh
 * the history.
 */
export const restoreTaskBody = async (
    accessToken: string | null,
    taskId: number,
    activityId: number
): Promise<RestoreTaskBodyResult> => {
    const api = authApi(accessToken);
    if (!api) return "failed";
    try {
        await api.post(
            "/task/activity/restore-body/",
            { task_id: taskId, activity_id: activityId },
            // The dialog says what happened; a second toast would repeat it.
            { suppressErrorToast: true }
        );
        return "ok";
    } catch (error: unknown) {
        if (axios.isAxiosError(error) && [400, 404].includes(error.response?.status ?? 0)) {
            return "not-found";
        }
        return "failed";
    }
};
