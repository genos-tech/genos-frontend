import { tasksChannel } from "../../../db/workers/channels";
import { syncStatus, tasksScope } from "../../../services/syncStatus";
import { UserProps } from "../../../types/admin";
import { ThreadMessageProps } from "../../../types/chat";
import { isProjectGoneError } from "./loadProjectTasksFromApi";

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
    //
    // `track` is what tells the sync status about this load, whichever caller
    // asked (boot, wake, project switch; MIP-1298): in flight, answered, or
    // failed, under THIS project's own scope so another project's load cannot
    // clear or raise it (MIP-1323). A project that is gone for the user (404 / 403)
    // is forgotten, not failed: the load can never succeed.
    const request = tasksChannel
        .request("loadProjectTasks", { myself, projectId, accessToken })
        .then(() => [] as ThreadMessageProps[]);
    const promise = syncStatus
        .track(tasksScope(projectId), request, { gone: isProjectGoneError })
        .finally(() => {
            inFlight.delete(key);
        });

    inFlight.set(key, promise);
    return promise;
};
