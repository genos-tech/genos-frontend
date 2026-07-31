import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { NoteFolderTagProps } from "../../../../types/notes";

export type NoteFolderTagWithUsage = NoteFolderTagProps & {
    createdBy: string | null;
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
    name: string,
    accessToken: string | null
): Promise<NoteFolderTagProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/note/team/tag/", {
                team_id: myself.teamId,
                name,
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
