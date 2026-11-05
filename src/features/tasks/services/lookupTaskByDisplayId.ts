import { isAxiosError } from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { SearchTeamTasksResponse } from "../../../types/tasks";

// The `#` menus and the task search bar hold open work only; this finds
// one task by its exact id whatever its status (MIP-739). Same row shape
// as `/search/teamTasks/`. Found rows are cached for the session.
//
// The id may not exist (a typo, `#kds-652`), and the callers ask again on every
// keystroke or re-render, so a miss must not become a request each time
// (MIP-1038):
//   - concurrent asks for one id share ONE request;
//   - a 404 ("no such task, or not yours to see") is remembered for
//     `MISS_MEMORY_MS`. It expires so that a task created a moment later is found
//     on the next try after it;
//   - anything else that goes wrong (offline, 5xx) is not "no such task", so it is
//     never remembered and the next ask retries.
const found = new Map<string, SearchTeamTasksResponse>();
const inFlight = new Map<string, Promise<SearchTeamTasksResponse | null>>();
const missedUntil = new Map<string, number>();

export const MISS_MEMORY_MS = 30_000;

export const lookupTaskByDisplayId = async (
    myself: Pick<UserProps, "teamId">,
    displayId: string,
    accessToken: string | null
): Promise<SearchTeamTasksResponse | null> => {
    const key = `${myself.teamId}:${displayId.toUpperCase()}`;
    const cached = found.get(key);
    if (cached) return cached;
    const api = authApi(accessToken);
    if (!api || !myself.teamId) return null;

    const missUntil = missedUntil.get(key);
    if (missUntil !== undefined) {
        if (Date.now() < missUntil) return null;
        missedUntil.delete(key);
    }
    const pending = inFlight.get(key);
    if (pending) return pending;

    const request = (async () => {
        try {
            const res = await api.get("/search/taskByDisplayId/", {
                params: { team_id: myself.teamId, display_id: displayId },
            });
            const row = res.data as SearchTeamTasksResponse;
            if (row?.taskId != null) {
                found.set(key, row);
                return row;
            }
        } catch (error) {
            // A 404 is the server saying there is no such task for this person;
            // network errors and 5xx say nothing about the task, so they are
            // not remembered. Either way the caller has no extra row to offer.
            if (isAxiosError(error) && error.response?.status === 404) {
                missedUntil.set(key, Date.now() + MISS_MEMORY_MS);
            }
        } finally {
            inFlight.delete(key);
        }
        return null;
    })();
    inFlight.set(key, request);
    return request;
};

/** Test seam. */
export const clearTaskLookupCache = () => {
    found.clear();
    inFlight.clear();
    missedUntil.clear();
};
