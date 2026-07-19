import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";
import { ProjectTaskFieldRules, TaskFieldRules } from "../utils/taskFieldRules";

// Owner-configured required/default rules for task+milestone creation
// metadata. GET is member-scoped (every member's create form enforces
// them); PUT is owner-only server-side. Both return null on failure —
// consumers fail OPEN (no rules enforced) by design.

const mapResponse = (projectId: number, data: unknown): ProjectTaskFieldRules => {
    const payload = (data ?? {}) as { rules?: TaskFieldRules; ownerUserId?: string | null };
    return {
        projectId,
        ownerUserId: payload.ownerUserId ?? null,
        rules: payload.rules ?? {},
    };
};

export const loadProjectTaskFieldRules = async (
    myself: UserProps,
    projectId: number,
    accessToken: string | null
): Promise<ProjectTaskFieldRules | null> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const res = await api.get(`/project/task-field-rules/?project_id=${projectId}`);
            return mapResponse(projectId, res.data);
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

// Replaces the whole rules blob (empty object clears every rule).
// Returns the saved state, or null on failure (incl. 403 non-owner).
export const saveProjectTaskFieldRules = async (
    projectId: number,
    rules: TaskFieldRules,
    accessToken: string | null
): Promise<ProjectTaskFieldRules | null> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const res = await api.put(`/project/task-field-rules/`, {
                project_id: projectId,
                rules,
            });
            return mapResponse(projectId, res.data);
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
