import { createRequestCache } from "../../../services/requestCache";

// The loads of `loadSpecificTask` that are running right now, so concurrent
// callers for the same task share ONE IndexedDB read, ONE `getTask` request
// and ONE result instead of each doing their own (MIP-968).
//
// `ttlMs: 0` = share only while a load is in flight. Nothing is kept once it
// settles, so the next call starts a fresh load and still sees whatever the
// caches hold by then.
//
// The value is the loader's own result (`TaskProps[]`, or `undefined` after a
// failure, typed loosely like `loadSpecificTask` itself). Every caller of a
// shared load gets the SAME array and task object: treat them as read-only.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const inFlightTaskLoads = createRequestCache<any>({ ttlMs: 0 });

/** Same task + team + project + freshness bound = the same question. */
export const inFlightTaskKey = (
    taskId: number,
    teamId: string | null | undefined,
    projectId: number,
    expectedMinUpdatedAt: string | null | undefined
): string => `${taskKeyPrefix(taskId)}${teamId}:${projectId}:${expectedMinUpdatedAt ?? ""}`;

// The trailing ":" matters: forgetting task 7 must not forget task 70.
const taskKeyPrefix = (taskId: number | string): string => `task:${taskId}:`;

/**
 * Stop handing out the load that is running for `taskId`.
 *
 * Call it right next to every write or invalidation of that task's IndexedDB
 * entry (a save, an attachment delete, a milestone or diagram edit). A load
 * that started before the write may still be holding the pre-write task; a
 * caller arriving after the write must start its own load instead of joining
 * it. The callers already waiting keep their promise.
 */
export const forgetInFlightTask = (taskId: number | string): void => {
    inFlightTaskLoads.invalidate(taskKeyPrefix(taskId));
};
