import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

export type DeleteMyNoteFolderResult = {
    deletedFolderIds: number[];
    deletedNoteIds: number[];
};

// DESTRUCTIVE: deleting a folder permanently deletes the whole subtree
// on the backend — every descendant folder, every note filed in it,
// and those notes' child-note chains. Returns the deleted ids (used to
// close tabs / purge local caches), or null on failure.
export const deleteMyNoteFolder = async (
    myself: UserProps,
    folderId: number,
    accessToken: string | null
): Promise<DeleteMyNoteFolderResult | null> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}&folder_id=${folderId}`;
            const res = await api.delete(`/note/personal/folder/?${query}`);
            return {
                deletedFolderIds: res.data?.deletedFolderIds ?? [],
                deletedNoteIds: res.data?.deletedNoteIds ?? [],
            };
        } else {
            console.error("Unauthorized. Auth toke is not found.");
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
