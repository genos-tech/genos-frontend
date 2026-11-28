import axios from "axios";

import { authApi } from "../../../services/api";
import { ProjectStatusDef } from "../../../types/tasks";

// The editor shows each refusal where it happened (a name taken, a status in use, which is a
// question and not an error), so the global error toast stays out of it.
const QUIET = { suppressErrorToast: true } as const;

// `/api/v2/projects/<id>/statuses/` (MIP-2492). Any member reads; the owner or an editor
// changes. Reading writes nothing: a project nobody set up lists no statuses.

export type ProjectStatusesPayload = { statuses: ProjectStatusDef[]; canManage: boolean };

export type StatusWriteResult =
    | { ok: true; data: ProjectStatusesPayload }
    | { ok: false; code: string; inUse: number };

const toPayload = (data: unknown): ProjectStatusesPayload => {
    const payload = (data ?? {}) as Partial<ProjectStatusesPayload>;
    return {
        statuses: Array.isArray(payload.statuses) ? payload.statuses : [],
        canManage: payload.canManage === true,
    };
};

const url = (projectId: number, statusId?: number) =>
    `/projects/${projectId}/statuses/${statusId != null ? `${statusId}/` : ""}`;

export const loadProjectStatuses = async (
    projectId: number,
    accessToken: string | null
): Promise<ProjectStatusesPayload | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        const res = await api.get(url(projectId));
        return toPayload(res.data);
    } catch (error: unknown) {
        console.error("Loading project statuses failed:", error);
        return null;
    }
};

const failure = (error: unknown): StatusWriteResult => {
    const data = axios.isAxiosError(error)
        ? (error.response?.data as { code?: string; inUse?: number } | undefined)
        : undefined;
    console.error("Saving a project status failed:", error);
    return { ok: false, code: data?.code ?? "", inUse: data?.inUse ?? 0 };
};

const write = async (
    accessToken: string | null,
    run: (api: NonNullable<ReturnType<typeof authApi>>) => Promise<{ data: unknown }>
): Promise<StatusWriteResult> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, code: "", inUse: 0 };
        const res = await run(api);
        return { ok: true, data: toPayload(res.data) };
    } catch (error: unknown) {
        return failure(error);
    }
};

/** Reorder; an empty order is how the built-in statuses are first written ("set up"). */
export const reorderProjectStatuses = (
    projectId: number,
    order: number[],
    accessToken: string | null
) => write(accessToken, (api) => api.put(url(projectId), { order }, QUIET));

/** The server answers an add with the one row, so the whole list is read again. */
export const createProjectStatus = async (
    projectId: number,
    input: { name: string; category: string; color?: string; is_default?: boolean },
    accessToken: string | null
): Promise<StatusWriteResult> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, code: "", inUse: 0 };
        await api.post(url(projectId), input, QUIET);
        const res = await api.get(url(projectId));
        return { ok: true, data: toPayload(res.data) };
    } catch (error: unknown) {
        return failure(error);
    }
};

export const updateProjectStatus = (
    projectId: number,
    statusId: number,
    patch: { name?: string; color?: string; is_default?: boolean; archived?: boolean },
    accessToken: string | null
) => write(accessToken, (api) => api.patch(url(projectId, statusId), patch, QUIET));

export const deleteProjectStatus = (
    projectId: number,
    statusId: number,
    replacementId: number | null,
    accessToken: string | null
) =>
    write(accessToken, (api) =>
        api.delete(url(projectId, statusId), {
            ...QUIET,
            data: replacementId != null ? { replacement_status_id: replacementId } : {},
        })
    );
