import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { NoteFolderTagProps } from "../../../../types/notes";

export type NoteFolderTagWithUsage = NoteFolderTagProps & {
    createdBy?: string | null;
    folderCount: number;
};

export const loadNoteFolderTags = async (
    myself: UserProps,
    accessToken: string | null
): Promise<NoteFolderTagWithUsage[]> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.get(`/note/team/tag/?team_id=${myself.teamId}`);
            return Array.isArray(res.data) ? res.data : [];
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return [];
};

// Create is idempotent server-side on (team, name): the vocabulary is
// shared, so two people naming the same tag converge on one row rather
// than the second failing.
export const createNoteFolderTag = async (
    myself: UserProps,
    input: { name: string; color?: string; textColor?: string },
    accessToken: string | null
): Promise<NoteFolderTagProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/note/team/tag/", {
                team_id: myself.teamId,
                name: input.name,
                color: input.color,
                text_color: input.textColor,
            });
            return res.data;
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return undefined;
};

// Rename and/or recolour a tag TEAM-WIDE. Key-presence on the wire, so
// a rename can't silently clear the colour. Gated server-side to the
// tag's creator or the team owner, since it changes every folder that
// carries it.
export const updateNoteFolderTag = async (
    myself: UserProps,
    tagId: number,
    changes: { name?: string; color?: string; textColor?: string },
    accessToken: string | null
): Promise<NoteFolderTagProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const payload: Record<string, unknown> = {
                team_id: myself.teamId,
                tag_id: tagId,
            };
            if (changes.name !== undefined) payload.name = changes.name;
            if (changes.color !== undefined) payload.color = changes.color;
            if (changes.textColor !== undefined) payload.text_color = changes.textColor;
            const res = await api.put("/note/team/tag/", payload);
            return res.data;
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return undefined;
};

export const deleteNoteFolderTag = async (
    myself: UserProps,
    tagId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            await api.delete(`/note/team/tag/?team_id=${myself.teamId}&tag_id=${tagId}`);
            return true;
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return false;
};

// REPLACES the folder's tags with `tagIds` — send the full desired set,
// not a delta, so unchecking a tag actually detaches it.
export const setFolderTags = async (
    myself: UserProps,
    folderId: number,
    tagIds: number[],
    accessToken: string | null
): Promise<NoteFolderTagProps[] | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/note/team/folder/tag/", {
                team_id: myself.teamId,
                folder_id: folderId,
                tag_ids: tagIds,
            });
            return Array.isArray(res.data) ? res.data : [];
        }
        console.error("Unauthorized. Auth token is not found.");
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return undefined;
};
