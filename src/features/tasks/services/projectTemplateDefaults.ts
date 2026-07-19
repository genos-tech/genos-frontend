import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

// Per-project default body template, one for tasks (and subtasks) and one
// for milestones. Each value is a create-form picker string — a built-in
// id ("default"/"bug"/"spike"/"milestone") or a custom "custom:{id}" — or
// null to fall back to the built-in default.
export type ProjectTemplateDefaults = {
    task: string | null;
    milestone: string | null;
};

const EMPTY_DEFAULTS: ProjectTemplateDefaults = { task: null, milestone: null };

export const loadProjectTemplateDefaults = async (
    myself: UserProps,
    projectId: number,
    accessToken: string | null
): Promise<ProjectTemplateDefaults> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const res = await api.get(`/project/task-template/defaults/?project_id=${projectId}`);
            return {
                task: res.data?.task ?? null,
                milestone: res.data?.milestone ?? null,
            };
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return EMPTY_DEFAULTS;
};

// Set (or clear, with value=null) the default for one kind. Returns the
// full updated defaults, or null on failure.
export const saveProjectTemplateDefault = async (
    projectId: number,
    kind: "task" | "milestone",
    value: string | null,
    accessToken: string | null
): Promise<ProjectTemplateDefaults | null> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const res = await api.put(`/project/task-template/defaults/`, {
                project_id: projectId,
                kind,
                value,
            });
            return {
                task: res.data?.task ?? null,
                milestone: res.data?.milestone ?? null,
            };
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return null;
};
