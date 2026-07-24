import axios from "axios";

import { authApi } from "../../../services/api";
import { CustomFieldOption, CustomFieldType, ProjectCustomFieldDef } from "../../../types/tasks";

// CRUD for per-project custom task field DEFINITIONS
// (/api/v2/project/custom-fields/). Values never flow through here —
// they ride on the task rows as `customFieldValues` via the existing
// task/milestone save services.
//
// GET is member-gated; mutations are owner/editor-gated server-side
// (403 for viewers — the UI additionally hides the manage entry points
// behind `canManage`). All functions return null on failure; consumers
// fail soft (no fields rendered) by design.

export type ProjectCustomFieldsPayload = {
    fields: ProjectCustomFieldDef[];
    canManage: boolean;
};

const mapListResponse = (data: unknown): ProjectCustomFieldsPayload => {
    const payload = (data ?? {}) as {
        fields?: ProjectCustomFieldDef[];
        canManage?: boolean;
    };
    return {
        fields: Array.isArray(payload.fields) ? payload.fields : [],
        canManage: payload.canManage === true,
    };
};

const logError = (error: unknown): void => {
    if (axios.isAxiosError(error)) {
        console.error("API error:", error.response?.status, error.response?.data);
    } else {
        console.error("Unexpected error:", error);
    }
};

export const loadProjectCustomFields = async (
    projectId: number,
    accessToken: string | null
): Promise<ProjectCustomFieldsPayload | null> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const res = await api.get(`/project/custom-fields/?project_id=${projectId}`);
            return mapListResponse(res.data);
        }
    } catch (error: unknown) {
        logError(error);
    }
    return null;
};

export const createProjectCustomField = async (
    projectId: number,
    input: { fieldName: string; fieldType: CustomFieldType; options?: CustomFieldOption[] },
    accessToken: string | null
): Promise<ProjectCustomFieldDef | null> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const res = await api.post(`/project/custom-fields/`, {
                project_id: projectId,
                field_name: input.fieldName,
                field_type: input.fieldType,
                options: input.options ?? [],
            });
            return res.data as ProjectCustomFieldDef;
        }
    } catch (error: unknown) {
        logError(error);
    }
    return null;
};

export const updateProjectCustomField = async (
    projectId: number,
    fieldId: number,
    patch: { fieldName?: string; options?: CustomFieldOption[] },
    accessToken: string | null
): Promise<ProjectCustomFieldDef | null> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const body: Record<string, unknown> = {
                project_id: projectId,
                field_id: fieldId,
            };
            if (patch.fieldName !== undefined) body.field_name = patch.fieldName;
            if (patch.options !== undefined) body.options = patch.options;
            const res = await api.put(`/project/custom-fields/`, body);
            return res.data as ProjectCustomFieldDef;
        }
    } catch (error: unknown) {
        logError(error);
    }
    return null;
};

export const deleteProjectCustomField = async (
    projectId: number,
    fieldId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            await api.delete(`/project/custom-fields/`, {
                data: { project_id: projectId, field_id: fieldId },
            });
            return true;
        }
    } catch (error: unknown) {
        logError(error);
    }
    return false;
};

export const reorderProjectCustomFields = async (
    projectId: number,
    order: number[],
    accessToken: string | null
): Promise<ProjectCustomFieldsPayload | null> => {
    try {
        const api = authApi(accessToken);
        if (api && projectId) {
            const res = await api.put(`/project/custom-fields/`, {
                project_id: projectId,
                order,
            });
            return mapListResponse(res.data);
        }
    } catch (error: unknown) {
        logError(error);
    }
    return null;
};
