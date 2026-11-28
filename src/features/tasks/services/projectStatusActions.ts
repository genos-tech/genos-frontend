import axios from "axios";

import { authApi } from "../../../services/api";
import { ProjectStatusAction } from "../../../types/tasks";

// `/api/v2/projects/<id>/status-actions/` (MIP-2603): a project's quick status buttons. Any
// member reads; the owner or an editor changes. Every write answers with the whole list.

// The editor shows each refusal where it happened.
const QUIET = { suppressErrorToast: true } as const;

export type ProjectStatusActionsPayload = {
    actions: ProjectStatusAction[];
    canManage: boolean;
    /** The buttons are offered: not in an archived project, nor to a View only share. */
    canAct: boolean;
};

export type ActionWriteResult =
    | { ok: true; data: ProjectStatusActionsPayload }
    | { ok: false; code: string };

export type ActionInput = {
    before_status_id?: number;
    after_status_id?: number;
    /** Null goes back to the default title. */
    title?: string | null;
    enabled?: boolean;
};

const toPayload = (data: unknown): ProjectStatusActionsPayload => {
    const payload = (data ?? {}) as Partial<ProjectStatusActionsPayload>;
    return {
        actions: Array.isArray(payload.actions) ? payload.actions : [],
        canManage: payload.canManage === true,
        canAct: payload.canAct === true,
    };
};

const url = (projectId: number, actionId?: number) =>
    `/projects/${projectId}/status-actions/${actionId != null ? `${actionId}/` : ""}`;

export const loadProjectStatusActions = async (
    projectId: number,
    accessToken: string | null
): Promise<ProjectStatusActionsPayload | null> => {
    try {
        const api = authApi(accessToken);
        if (!api) return null;
        // Without the list there are no buttons; the status picker still works.
        const res = await api.get(url(projectId), QUIET);
        return toPayload(res.data);
    } catch (error: unknown) {
        console.error("Loading quick status actions failed:", error);
        return null;
    }
};

const write = async (
    accessToken: string | null,
    run: (api: NonNullable<ReturnType<typeof authApi>>) => Promise<{ data: unknown }>
): Promise<ActionWriteResult> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, code: "" };
        const res = await run(api);
        return { ok: true, data: toPayload(res.data) };
    } catch (error: unknown) {
        console.error("Saving a quick status action failed:", error);
        const data = axios.isAxiosError(error)
            ? (error.response?.data as { code?: string } | undefined)
            : undefined;
        return { ok: false, code: data?.code ?? "" };
    }
};

export const createProjectStatusAction = (
    projectId: number,
    input: ActionInput,
    accessToken: string | null
) => write(accessToken, (api) => api.post(url(projectId), input, QUIET));

export const updateProjectStatusAction = (
    projectId: number,
    actionId: number,
    patch: ActionInput,
    accessToken: string | null
) => write(accessToken, (api) => api.patch(url(projectId, actionId), patch, QUIET));

export const deleteProjectStatusAction = (
    projectId: number,
    actionId: number,
    accessToken: string | null
) => write(accessToken, (api) => api.delete(url(projectId, actionId), QUIET));

export const reorderProjectStatusActions = (
    projectId: number,
    order: number[],
    accessToken: string | null
) => write(accessToken, (api) => api.put(url(projectId), { order }, QUIET));
