import axios from "axios";

import { authApi } from "../../../services/api";
import { StoredTaskFilters } from "../utils/taskFilterStorage";

// CRUD for project-shared named task-filter selections — the "Saved
// Filters" control in the task filter bar
// (/api/v2/project/saved-task-filters/).
//
// Rows are PROJECT-scoped rather than per-user: a filter one member saves
// is available to every other member of that project, which is why these
// live server-side while the "what was I last looking at" selection stays
// in localStorage (`taskFilterStorage`).
//
// Every verb is project-member gated server-side. All functions fail soft
// — a list failure yields `null` and the menu simply shows nothing rather
// than blocking the filter bar it sits in.

// The saved selection. Deliberately `Partial`: `status` is absent on a
// filter saved from the sprint board, which hides that dimension and pins
// it to "All" — recording the pinned value would silently widen a table
// view to include Closed/Deleted rows. Every other dimension can also be
// missing on a blob written by an older client.
export type SavedFilterPayload = Partial<StoredTaskFilters>;

export type ProjectSavedFilter = {
    id: number;
    filterName: string;
    filters: SavedFilterPayload;
    /** Display hint only — any project member may edit or delete any
     *  saved filter (same trust model as project tags/templates). */
    createdBy: string | null;
    tsUpdatedAt: string;
};

const logError = (error: unknown): void => {
    if (axios.isAxiosError(error)) {
        console.error("API error:", error.response?.status, error.response?.data);
    } else {
        console.error("Unexpected error:", error);
    }
};

const mapRow = (raw: unknown): ProjectSavedFilter => {
    const r = (raw ?? {}) as Record<string, unknown>;
    return {
        id: Number(r.id),
        filterName: typeof r.filterName === "string" ? r.filterName : "",
        filters:
            typeof r.filters === "object" && r.filters !== null && !Array.isArray(r.filters)
                ? (r.filters as SavedFilterPayload)
                : {},
        createdBy: r.createdBy == null ? null : String(r.createdBy),
        tsUpdatedAt: typeof r.tsUpdatedAt === "string" ? r.tsUpdatedAt : "",
    };
};

export const loadProjectSavedFilters = async (
    teamId: string,
    projectId: number,
    accessToken: string | null
): Promise<ProjectSavedFilter[] | null> => {
    try {
        const api = authApi(accessToken);
        if (api && teamId && projectId) {
            const res = await api.get(
                `/project/saved-task-filters/?team_id=${teamId}&project_id=${projectId}`
            );
            return Array.isArray(res.data) ? res.data.map(mapRow) : [];
        }
    } catch (error: unknown) {
        logError(error);
    }
    return null;
};

export const createProjectSavedFilter = async (
    teamId: string,
    projectId: number,
    filterName: string,
    filters: SavedFilterPayload,
    accessToken: string | null
): Promise<ProjectSavedFilter | null> => {
    try {
        const api = authApi(accessToken);
        if (api && teamId && projectId) {
            const res = await api.post(`/project/saved-task-filters/`, {
                team_id: teamId,
                project_id: projectId,
                filter_name: filterName,
                filters,
            });
            return mapRow(res.data);
        }
    } catch (error: unknown) {
        logError(error);
    }
    return null;
};

/** Rename and/or overwrite a saved filter.
 *
 *  Both fields are independently optional server-side, which is what
 *  makes the two user gestures one call: renaming sends `filterName`
 *  alone, and "save over the existing name" sends `filters` alone. A
 *  same-name create is resolved to THIS call by the menu, because the
 *  unique (project, name) constraint makes a duplicate POST a 400.
 */
export const updateProjectSavedFilter = async (
    projectId: number,
    filterId: number,
    patch: { filterName?: string; filters?: SavedFilterPayload },
    accessToken: string | null
): Promise<ProjectSavedFilter | null> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const body: Record<string, unknown> = {
                project_id: projectId,
                id: filterId,
            };
            if (patch.filterName !== undefined) body.filter_name = patch.filterName;
            if (patch.filters !== undefined) body.filters = patch.filters;
            const res = await api.put(`/project/saved-task-filters/`, body);
            return mapRow(res.data);
        }
    } catch (error: unknown) {
        logError(error);
    }
    return null;
};

export const deleteProjectSavedFilter = async (
    projectId: number,
    filterId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            await api.delete(`/project/saved-task-filters/`, {
                data: { project_id: projectId, id: filterId },
            });
            return true;
        }
    } catch (error: unknown) {
        logError(error);
    }
    return false;
};
