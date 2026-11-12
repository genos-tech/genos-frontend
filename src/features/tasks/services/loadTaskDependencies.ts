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

/**
 * Load one task's dependency edges and hand them to `store` (the task
 * manager's map). With `land`, the write is handed over instead of run, so
 * a task preview can land it together with its other loaders (see
 * taskOpenLanding.ts). `land` is called even when the load failed (with a
 * write that does nothing), so a waiting batch is never kept for it.
 */
export const loadTaskDependenciesInto = async (
    taskId: number,
    accessToken: string | null,
    store: (dependencies: TaskDependencies) => void,
    land?: (write: () => void) => void
): Promise<void> => {
    const result = await loadTaskDependencies(taskId, accessToken);
    const write = () => {
        if (result) store(result);
    };
    if (land) land(write);
    else write();
};

// Mirrors the backend cap on /task/dependency/list-for-tasks/.
const BATCH_MAX_IDS = 500;
// Batches in flight at once. The endpoint is under the `batch_read` throttle
// (120/min), so a big tree must not fire every batch at the same moment.
export const BATCH_CONCURRENCY = 3;
// How long to wait before the one retry of a failed batch. A 429 that says
// when to come back (`Retry-After`) is honoured up to the ceiling.
export const BATCH_RETRY_DELAY_MS = 1000;
const BATCH_RETRY_CEILING_MS = 5000;

export type TaskDependenciesBatch = {
    /** One entry per id whose batch answered (missing server entries are empty lists). */
    byTask: Record<number, TaskDependencies>;
    /** Ids whose batch failed twice. They have NO entry in `byTask`: an empty
     *  list would read as "no dependencies" and erase real edges. */
    failedIds: number[];
};

type BatchOptions = { sleep?: (ms: number) => Promise<void> };

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const retryDelay = (error: unknown): number => {
    if (axios.isAxiosError(error) && error.response?.status === 429) {
        const header = Number(error.response.headers?.["retry-after"]);
        if (Number.isFinite(header) && header > 0) {
            return Math.min(header * 1000, BATCH_RETRY_CEILING_MS);
        }
    }
    return BATCH_RETRY_DELAY_MS;
};

const logBatchError = (error: unknown) => {
    if (axios.isAxiosError(error)) {
        console.error("Batch API error:", error.response?.status, error.response?.data);
    } else {
        console.error("Unexpected error:", error);
    }
};

/**
 * Resolve the dependency edges for a whole task set, one request per ≤500
 * ids, at most `BATCH_CONCURRENCY` at a time. The task-graph diagram walks
 * every node in the visible tree; per-task GETs meant N requests, each paying
 * its own CORS preflight too.
 *
 * A failed batch is retried ONCE after a short wait (MIP-1416). It used to
 * fall back to one GET per task: on a 429 from the read throttle that turned
 * one refused request into hundreds more, against the same throttle. Ids
 * whose batch still fails are reported in `failedIds` and left out of
 * `byTask`, so the caller can say the picture is partial.
 */
export const loadTaskDependenciesBatched = async (
    taskIds: number[],
    accessToken: string | null,
    options: BatchOptions = {}
): Promise<TaskDependenciesBatch | undefined> => {
    const unique = [...new Set(taskIds)].filter((id) => Number.isFinite(id));
    if (unique.length === 0) return { byTask: {}, failedIds: [] };
    const api = authApi(accessToken);
    if (!api) {
        console.error("Unauthorized. Auth token is not found.");
        return undefined;
    }
    const sleep = options.sleep ?? defaultSleep;
    const chunks: number[][] = [];
    for (let i = 0; i < unique.length; i += BATCH_MAX_IDS) {
        chunks.push(unique.slice(i, i + BATCH_MAX_IDS));
    }

    const byTask: Record<number, TaskDependencies> = {};
    const failedIds: number[] = [];
    const fetchChunk = async (chunk: number[]) => {
        const url = `/task/dependency/list-for-tasks/?task_ids=${chunk.join(",")}`;
        let res;
        try {
            res = await api.get(url);
        } catch (first: unknown) {
            logBatchError(first);
            await sleep(retryDelay(first));
            try {
                res = await api.get(url);
            } catch (second: unknown) {
                logBatchError(second);
                failedIds.push(...chunk);
                return;
            }
        }
        const answered = res.data?.dependencies_by_task ?? {};
        for (const id of chunk) {
            const entry = answered[String(id)];
            byTask[id] = {
                blocking: Array.isArray(entry?.blocking) ? entry.blocking : [],
                blockedBy: Array.isArray(entry?.blockedBy) ? entry.blockedBy : [],
            };
        }
    };

    // A small pool: each worker takes the next chunk until none are left.
    let next = 0;
    const worker = async () => {
        while (next < chunks.length) {
            const chunk = chunks[next];
            next += 1;
            await fetchChunk(chunk);
        }
    };
    await Promise.all(
        Array.from({ length: Math.min(BATCH_CONCURRENCY, chunks.length) }, () => worker())
    );
    return { byTask, failedIds };
};

/**
 * `loadTaskDependenciesBatched`, as the plain map its callers read. An id
 * whose batch failed has no entry (see `failedIds` above for why): a caller
 * that merges the map into its store keeps what it already had for it.
 */
export const loadTaskDependenciesForTasks = async (
    taskIds: number[],
    accessToken: string | null,
    options: BatchOptions = {}
): Promise<Record<number, TaskDependencies> | undefined> => {
    const result = await loadTaskDependenciesBatched(taskIds, accessToken, options);
    return result?.byTask;
};
