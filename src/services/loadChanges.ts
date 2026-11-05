import { authApi } from "./api";

/**
 * `GET /api/v2/changes/` — one cheap call that says which collections changed
 * since the caller last looked (see `context/changeRefresher`).
 *
 * Returns the raw body; `parseChangeTokens` decides whether it is usable.
 * THROWS on any failure (a 404 from an API that predates the endpoint, a
 * 5xx, no network): the caller turns every failure into today's full refresh,
 * so there is nothing useful to do with the reason here.
 *
 * `suppressErrorToast`: the response interceptor would otherwise raise a
 * "request failed" toast for the 404 on every tick until the API ships the
 * endpoint, for a call the user never asked for and the app recovers from.
 *
 * `project_id` is left out (not sent as "undefined"/"null") when no project is
 * open: the server answers `tasks_project: null` then.
 */
export const loadChanges = async (
    accessToken: string | null | undefined,
    teamId: string | number,
    projectId: number | null
): Promise<unknown> => {
    const api = authApi(accessToken);
    if (!api) throw new Error("No access token");
    const params = new URLSearchParams({ team_id: String(teamId) });
    if (projectId != null) params.set("project_id", String(projectId));
    const res = await api.get(`/changes/?${params.toString()}`, { suppressErrorToast: true });
    return res.data;
};
