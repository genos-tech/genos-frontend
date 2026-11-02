import { getCachedFullTask } from "../../../db/services/task-full.service";
import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { loadSpecificTask } from "./loadSpecificTask";

/**
 * The task as the server holds it, for putting a preview back after the
 * server REFUSED a save (`TaskSaveRefusedError`). Always asks the server:
 * `loadSpecificTask`'s default answers from the IndexedDB cache, which is
 * exactly what a "reload" must not do.
 *
 * `workingProjectId` is only a fallback. `GET /task/getTask/` filters on
 * `project_id`, so a task whose project the person just changed (the refused
 * move) would come back EMPTY if asked for in the destination project. The
 * full-task cache is written only by loads and by saves that succeeded, so
 * the project it holds is the one the task is actually stored in.
 *
 * Resolves with the last cached copy when the server cannot be reached, and
 * `null` when there is nothing to put back.
 */
export const reloadStoredTask = async (
    myself: UserProps,
    taskId: number,
    workingProjectId: number | null | undefined,
    accessToken: string | null
): Promise<TaskProps | null> => {
    let cached: TaskProps | null = null;
    try {
        cached = await getCachedFullTask(taskId);
    } catch {
        // IndexedDB unavailable (private window, blocked site data): fall
        // back to the working copy's project below.
    }
    const projectId = cached?.project?.projectId ?? workingProjectId;
    if (projectId == null) return cached;
    const loaded = await loadSpecificTask(myself, projectId, taskId, accessToken, {
        forceRefresh: true,
    });
    if (Array.isArray(loaded) && loaded[0]) return loaded[0] as TaskProps;
    return cached;
};
