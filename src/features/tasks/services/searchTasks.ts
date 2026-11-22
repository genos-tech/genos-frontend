import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { SearchTeamTasksResponse } from "../../../types/tasks";

// The task bar's server search (MIP-1990): `GET /search/tasks/`, a paged query over every
// task the caller can reach (Closed included, Deleted never), by title or display id.
// Unlike `loadTeamTaskList` it never returns the whole list: `limit` rows at most.

export type TaskSearchPage = { results: SearchTeamTasksResponse[]; hasMore: boolean };

export type TaskSearchParams = {
    /** Empty = no text filter (the starting list). */
    q?: string;
    /** Only this project; omit for every project the caller can reach. */
    projectId?: number;
    /** Comma-separated lower-case statuses, e.g. "open,wip". Omit for all but Deleted. */
    statuses?: string;
    limit?: number;
    offset?: number;
};

/** Rejects on a failed or aborted request: the caller tells those apart (`signal.aborted`). */
export const searchTasks = async (
    myself: Pick<UserProps, "teamId">,
    accessToken: string | null,
    params: TaskSearchParams,
    signal?: AbortSignal
): Promise<TaskSearchPage> => {
    const api = authApi(accessToken);
    if (!api) throw new Error("Unauthorized");
    const res = await api.get("/search/tasks/", {
        params: {
            team_id: myself.teamId,
            q: params.q || undefined,
            project_id: params.projectId,
            statuses: params.statuses,
            limit: params.limit,
            offset: params.offset || undefined,
        },
        signal,
    });
    const data = res.data as Partial<TaskSearchPage> | undefined;
    return {
        results: Array.isArray(data?.results) ? data.results : [],
        hasMore: data?.hasMore === true,
    };
};
