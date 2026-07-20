// Team-scoped labels applied to whole PROJECTS.
//
// Distinct from `features/tasks/services/loadProjectTags.ts`, which
// serves the per-project tags applied to TASKS. See `ProjectLabelProps`
// in types/tasks.ts for the full distinction.
//
// Every mutation carries `project_id`: the catalog is team-shared, but
// the backend gates writes on "you own the project you're acting from"
// (`_require_project_owner`). The UI only exposes these inside
// ModalProjectProfile, which always has a project in hand.
import axios from "axios";

import { authApi } from "../../../services/api";
import { ProjectLabelProps } from "../../../types/tasks";

const logError = (label: string, error: unknown) => {
    if (axios.isAxiosError(error)) {
        console.error(`[projectLabels] ${label}:`, error.response?.status, error.response?.data);
    } else {
        console.error(`[projectLabels] ${label}:`, error);
    }
};

/** The team's whole label catalog, each with its assigned-project count. */
export const loadTeamProjectLabels = async (
    teamId: string,
    accessToken: string | null
): Promise<ProjectLabelProps[]> => {
    try {
        const api = authApi(accessToken);
        if (!api || !teamId) return [];
        const res = await api.get(`/project/label/?team_id=${teamId}`);
        return res.data ?? [];
    } catch (error: unknown) {
        logError("loadTeamProjectLabels", error);
        return [];
    }
};

/** Extracts a human-readable error from the backend's `{error: "..."}`. */
const errorMessage = (error: unknown, fallback: string): string => {
    if (axios.isAxiosError(error)) {
        const body = error.response?.data as { error?: string } | undefined;
        if (body?.error) return body.error;
    }
    return fallback;
};

export type LabelMutationResult =
    | { ok: true; label: ProjectLabelProps }
    | { ok: false; error: string };

export const createProjectLabel = async (
    projectId: number,
    name: string,
    color: string,
    textColor: string,
    accessToken: string | null
): Promise<LabelMutationResult> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, error: "Not authenticated." };
        const res = await api.post(`/project/label/`, {
            project_id: projectId,
            name,
            color,
            text_color: textColor,
        });
        return { ok: true, label: res.data };
    } catch (error: unknown) {
        logError("createProjectLabel", error);
        return { ok: false, error: errorMessage(error, "Could not create the label.") };
    }
};

/**
 * Rename / recolor a catalog label. Applies TEAM-WIDE — every project
 * carrying this label re-renders with the new value. Callers should make
 * that blast radius visible before firing (the manage UI shows the
 * assigned-project count).
 */
export const updateProjectLabel = async (
    projectId: number,
    labelId: number,
    patch: { name?: string; color?: string; textColor?: string },
    accessToken: string | null
): Promise<LabelMutationResult> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, error: "Not authenticated." };
        const res = await api.put(`/project/label/`, {
            project_id: projectId,
            label_id: labelId,
            ...(patch.name !== undefined ? { name: patch.name } : {}),
            ...(patch.color !== undefined ? { color: patch.color } : {}),
            ...(patch.textColor !== undefined ? { text_color: patch.textColor } : {}),
        });
        return { ok: true, label: res.data };
    } catch (error: unknown) {
        logError("updateProjectLabel", error);
        return { ok: false, error: errorMessage(error, "Could not update the label.") };
    }
};

/** Delete from the catalog. Assignments cascade — every project loses the chip. */
export const deleteProjectLabel = async (
    projectId: number,
    labelId: number,
    accessToken: string | null
): Promise<{ ok: boolean; error?: string }> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, error: "Not authenticated." };
        await api.delete(`/project/label/?project_id=${projectId}&label_id=${labelId}`);
        return { ok: true };
    } catch (error: unknown) {
        logError("deleteProjectLabel", error);
        return { ok: false, error: errorMessage(error, "Could not delete the label.") };
    }
};

/**
 * Replace this project's label set with `labelIds` (the FULL desired
 * set, not a delta — see the backend's assignment view). Returns the
 * resulting labels so the caller can render straight from the server's
 * answer rather than guessing.
 */
export const assignProjectLabels = async (
    projectId: number,
    labelIds: number[],
    accessToken: string | null
): Promise<{ ok: boolean; labels: ProjectLabelProps[]; error?: string }> => {
    try {
        const api = authApi(accessToken);
        if (!api) return { ok: false, labels: [], error: "Not authenticated." };
        const res = await api.put(`/project/label/assign/`, {
            project_id: projectId,
            label_ids: labelIds,
        });
        return { ok: true, labels: res.data ?? [] };
    } catch (error: unknown) {
        logError("assignProjectLabels", error);
        return {
            ok: false,
            labels: [],
            error: errorMessage(error, "Could not update this project's labels."),
        };
    }
};
