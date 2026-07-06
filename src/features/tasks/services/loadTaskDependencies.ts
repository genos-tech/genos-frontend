import axios from "axios";

import { authApi } from "../../../services/api";
import { TaskDependencies } from "../../../types/tasks";

export const loadTaskDependencies = async (
    taskId: number,
    accessToken: string | null
): Promise<TaskDependencies | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth token is not found.");
            return undefined;
        }
        const res = await api.get(`/task/dependency/list/?task_id=${taskId}`);
        const data = res.data;
        return {
            blocking: Array.isArray(data?.blocking) ? data.blocking : [],
            blockedBy: Array.isArray(data?.blockedBy) ? data.blockedBy : [],
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        return undefined;
    }
};

// Mirrors the backend cap on /task/dependency/list-for-tasks/.
const BATCH_MAX_IDS = 500;

const emptyDeps = (): TaskDependencies => ({ blocking: [], blockedBy: [] });

/**
 * Batched variant: resolve the dependency edges for a whole task set
 * in one request per ≤500 ids instead of one per task. The task-graph
 * diagram walks every node in the visible tree — per-task GETs meant
 * N requests, each paying its own CORS preflight too (the preflight
 * cache is keyed by exact URL, so unique `?task_id=` queries never
 * share one).
 *
 * Every requested id gets a key in the result (missing server entries
 * become empty lists). On any batch failure — including a 404 from a
 * backend that doesn't have the endpoint yet — falls back to parallel
 * per-task fetches so deploy order is safe in both directions.
 */
export const loadTaskDependenciesForTasks = async (
    taskIds: number[],
    accessToken: string | null
): Promise<Record<number, TaskDependencies> | undefined> => {
    const unique = [...new Set(taskIds)].filter((id) => Number.isFinite(id));
    if (unique.length === 0) return {};
    const api = authApi(accessToken);
    if (!api) {
        console.error("Unauthorized. Auth token is not found.");
        return undefined;
    }
    try {
        const out: Record<number, TaskDependencies> = {};
        for (let i = 0; i < unique.length; i += BATCH_MAX_IDS) {
            const chunk = unique.slice(i, i + BATCH_MAX_IDS);
            const res = await api.get(
                `/task/dependency/list-for-tasks/?task_ids=${chunk.join(",")}`
            );
            const byTask = res.data?.dependencies_by_task ?? {};
            for (const id of chunk) {
                const entry = byTask[String(id)];
                out[id] = {
                    blocking: Array.isArray(entry?.blocking) ? entry.blocking : [],
                    blockedBy: Array.isArray(entry?.blockedBy) ? entry.blockedBy : [],
                };
            }
        }
        return out;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("Batch API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        const singles = await Promise.all(
            unique.map((id) => loadTaskDependencies(id, accessToken))
        );
        const out: Record<number, TaskDependencies> = {};
        unique.forEach((id, idx) => {
            out[id] = singles[idx] ?? emptyDeps();
        });
        return out;
    }
};
