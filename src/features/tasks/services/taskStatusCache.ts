import { UserProps } from "../../../types/admin";
import { TaskProps } from "../../../types/tasks";
import { loadSpecificTask } from "./loadSpecificTask";

// Per-task status memo for the task-mention hover card, keyed by
// (teamId, projectId, taskId). Short TTL so rapid hovers don't spam the
// API, while reopening after ~a minute refetches. Module-scope is
// deliberate: a session-wide cache shared across every hover-card mount,
// not React state. Mirrors `features/integrations/services/prStatusCache`.
//
// `loadSpecificTask` itself checks IndexedDB first, so even a cache miss
// here is usually a local-disk read rather than a network round-trip. The
// same endpoint serves regular tasks and milestone backing tasks.
const TTL_MS = 60_000;
const cache = new Map<string, { fetchedAt: number; payload: TaskProps }>();

export type TaskStatusResult = { kind: "ok"; payload: TaskProps } | { kind: "error" };

export const getCachedOrFetchTaskStatus = async (
    myself: UserProps,
    projectId: number,
    taskId: number,
    accessToken: string | null
): Promise<TaskStatusResult> => {
    if (!Number.isFinite(projectId) || !Number.isFinite(taskId)) return { kind: "error" };

    const key = `${myself.teamId}:${projectId}:${taskId}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
        return { kind: "ok", payload: hit.payload };
    }

    const res = await loadSpecificTask(myself, projectId, taskId, accessToken);
    if (!Array.isArray(res) || !res[0]) return { kind: "error" };

    const payload = res[0] as TaskProps;
    cache.set(key, { fetchedAt: Date.now(), payload });
    return { kind: "ok", payload };
};

// Test affordance / future manual-refresh hook.
export const clearTaskStatusCache = (): void => cache.clear();
