import { tasksChannel } from "../../../db/workers/channels";
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
    if (!accessToken) {
        return Promise.resolve([]);
    }
    const key = `${myself.teamId}:${projectId}`;
    const existing = inFlight.get(key);
    if (existing) return existing;

    // The tasks-channel worker writes the result into IDB and replies with
    // "done"; the legacy worker did the same. Callers historically typed
    // the return as `ThreadMessageProps[]` but actually used it only as a
    // completion signal — keep the shape `[]` to preserve API surface.
    const promise = tasksChannel
        .request("loadProjectTasks", { myself, projectId, accessToken })
        .then(() => [] as ThreadMessageProps[])
        .finally(() => {
            inFlight.delete(key);
        });

    inFlight.set(key, promise);
    return promise;
};
