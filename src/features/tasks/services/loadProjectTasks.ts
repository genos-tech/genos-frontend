import { tasksChannel } from "../../../db/workers/channels";
import { syncStatus, tasksScope } from "../../../services/syncStatus";
import { UserProps } from "../../../types/admin";
import { ThreadMessageProps } from "../../../types/chat";
import { getProjectScope, recordProjectScope } from "../state/projectStatusScopeStore";
import {
    initialStatusNeed,
    scopeCovers,
    taskStatusScopeEnabled,
    unionScope,
    type StatusScope,
} from "../utils/projectStatusScope";
import { isProjectGoneError } from "./loadProjectTasksFromApi";

// In-flight cache so N concurrent callers for the same (teamId, projectId)
// share ONE network round-trip + ONE IDB batchInsert. The previous behaviour
// spawned a fresh worker (and a fresh `getProjectTasks` request) for every
// caller — visible in the network panel as 3× the same 80 kB response.
//
// The cache only holds the in-flight promise; both success and failure
// drop the entry via `.finally()` so the next call after a fetch settles
// always retries against the server.
//
// It also remembers which statuses the request is for (MIP-2000): a caller whose
// statuses the request already covers shares it; a caller that needs more waits for
// it and then loads the union, so two loads of one project never run side by side.
const inFlight = new Map<string, { promise: Promise<ThreadMessageProps[]>; need: StatusScope }>();

/**
 * Bring a project's rows into IndexedDB.
 *
 * `statuses` is what the caller needs held: a list of status labels, or `null` for all of
 * them. Left out, it is what the project's table shows on opening (its stored filter, else
 * the ongoing statuses). The store never holds less than it already did: a project that has
 * had Closed loaded keeps being refreshed with Closed (the worker keeps the wider set).
 */
export const loadProjectTasks = (
    myself: UserProps,
    projectId: number,
    accessToken: string | null,
    statuses?: StatusScope
): Promise<ThreadMessageProps[]> => {
    if (!accessToken) {
        return Promise.resolve([]);
    }
    // A caller that says nothing (boot, wake, the sync banner's Retry) loads what the table opens
    // on, plus whatever a view has asked for since: a widening that failed is thereby asked
    // again by the Retry, instead of the project settling for the narrow set.
    const wanted = getProjectScope(projectId).wanted;
    const need: StatusScope = !taskStatusScopeEnabled()
        ? null
        : statuses === undefined
          ? wanted === undefined
              ? initialStatusNeed(projectId)
              : unionScope(initialStatusNeed(projectId), wanted)
          : statuses;
    const key = `${myself.teamId}:${projectId}`;
    const existing = inFlight.get(key);
    if (existing && scopeCovers(existing.need, need)) return existing.promise;

    // The tasks-channel worker writes the result into IDB and replies with
    // what it now holds; callers historically typed the return as
    // `ThreadMessageProps[]` but actually used it only as a completion
    // signal — keep the shape `[]` to preserve API surface.
    //
    // `track` is what tells the sync status about this load, whichever caller
    // asked (boot, wake, project switch; MIP-1298): in flight, answered, or
    // failed, under THIS project's own scope so another project's load cannot
    // clear or raise it (MIP-1323). A project that is gone for the user (404 / 403)
    // is forgotten, not failed: the load can never succeed.
    const start = () => {
        const request = tasksChannel
            .request("loadProjectTasks", {
                myself,
                projectId,
                accessToken,
                statuses: need === null ? null : [...need],
            })
            .then((held) => {
                if (held) recordProjectScope(projectId, held);
                return [] as ThreadMessageProps[];
            });
        return syncStatus.track(tasksScope(projectId), request, { gone: isProjectGoneError });
    };

    const entry: { promise: Promise<ThreadMessageProps[]>; need: StatusScope } = {
        // A request already running that does not cover this one: run after it (its answer
        // may well make this one a no-op) and ask for the union, so whoever joins this
        // entry next is covered by both.
        promise: (existing
            ? existing.promise
                  .catch(() => [] as ThreadMessageProps[])
                  // The run just before may have left the store holding enough already.
                  .then((rows) =>
                      scopeCovers(getProjectScope(projectId).loaded, need) ? rows : start()
                  )
            : start()
        ).finally(() => {
            if (inFlight.get(key) === entry) inFlight.delete(key);
        }),
        need: existing ? unionScope(existing.need, need) : need,
    };
    inFlight.set(key, entry);
    return entry.promise;
};
