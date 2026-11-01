import axios from "axios";

import { authApi } from "../../../../services/api";
import { MilestoneFolder, ProjectMilestoneFoldersResponse } from "../types";

// Milestone folders (MIP-847). Any project member may call these. Each
// resolves to `undefined` on failure (logged), like the other milestone
// services, so a caller can tell "failed" from "empty".

const logError = (label: string, error: unknown) => {
    if (axios.isAxiosError(error)) {
        console.error(label, error.response?.status, error.response?.data);
    } else {
        console.error(label, error);
    }
};

export const loadMilestoneFolders = async (
    projectId: number,
    accessToken: string | null
): Promise<ProjectMilestoneFoldersResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const res = await api.get(`/milestone/folder/list/?project_id=${projectId}`);
        return res.data;
    } catch (error) {
        logError("loadMilestoneFolders error:", error);
    }
};

export const createMilestoneFolder = async (
    projectId: number,
    name: string,
    accessToken: string | null
): Promise<MilestoneFolder | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const res = await api.post("/milestone/folder/", { project_id: projectId, name });
        return res.data?.folder;
    } catch (error) {
        logError("createMilestoneFolder error:", error);
    }
};

export const updateMilestoneFolder = async (
    folderId: number,
    patch: { name?: string; sortOrder?: number },
    accessToken: string | null
): Promise<MilestoneFolder | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) return;
        const body: Record<string, unknown> = {};
        if (patch.name !== undefined) body.name = patch.name;
        if (patch.sortOrder !== undefined) body.sort_order = patch.sortOrder;
        const res = await api.patch(`/milestone/folder/${folderId}/`, body);
        return res.data?.folder;
    } catch (error) {
        logError("updateMilestoneFolder error:", error);
    }
};

export const deleteMilestoneFolder = async (
    folderId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (!api) return false;
        await api.delete(`/milestone/folder/${folderId}/`);
        return true;
    } catch (error) {
        logError("deleteMilestoneFolder error:", error);
        return false;
    }
};
