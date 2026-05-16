import LoadProjectTasksWorker from "../../../db/workers/loadProjectTasksWorker.ts?worker";
import { UserProps } from "../../../types/admin";
import { ThreadMessageProps } from "../../../types/chat";

// In-flight cache so N concurrent callers for the same (teamId, projectId)
// share ONE network round-trip + ONE IDB batchInsert. The previous behaviour
// spawned a fresh worker (and a fresh `getProjectTasks` request) for every
// caller — visible in the network panel as 3× the same 80 kB response.
//
// The cache only holds the in-flight promise; both success and failure
// drop the entry via `.finally()` so the next call after a fetch settles
// always retries against the server.
const inFlight = new Map<string, Promise<ThreadMessageProps[]>>();

export const loadProjectTasks = (
    myself: UserProps,
    projectId: number,
    accessToken: string | null
): Promise<ThreadMessageProps[]> => {
    const key = `${myself.teamId}:${projectId}`;
    const existing = inFlight.get(key);
    if (existing) return existing;

    const promise = new Promise<ThreadMessageProps[]>((resolve, reject) => {
        const worker = new LoadProjectTasksWorker();
        worker.postMessage({ myself, projectId, accessToken });
        worker.onmessage = (event) => {
            worker.terminate();
            resolve(event.data as ThreadMessageProps[]);
        };
        worker.onerror = (error) => {
            worker.terminate();
            console.error(error);
            reject(error);
        };
    }).finally(() => {
        inFlight.delete(key);
    });

    inFlight.set(key, promise);
    return promise;
};
