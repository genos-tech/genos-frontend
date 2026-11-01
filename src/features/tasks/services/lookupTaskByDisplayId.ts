import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { SearchTeamTasksResponse } from "../../../types/tasks";

// The `#` menus and the task search bar hold open work only; this finds
// one task by its exact id whatever its status (MIP-739). Same row shape
// as `/search/teamTasks/`. Found rows are cached for the session; a miss
// is not, so a task created a moment later is found on the next try.
const found = new Map<string, SearchTeamTasksResponse>();

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
    try {
        const res = await api.get("/search/taskByDisplayId/", {
            params: { team_id: myself.teamId, display_id: displayId },
        });
        const row = res.data as SearchTeamTasksResponse;
        if (row?.taskId != null) {
            found.set(key, row);
            return row;
        }
    } catch {
        // 404 (no such task, or not yours to see) and network errors alike:
        // the caller just has no extra row to offer.
    }
    return null;
};

/** Test seam. */
export const clearTaskLookupCache = () => found.clear();
