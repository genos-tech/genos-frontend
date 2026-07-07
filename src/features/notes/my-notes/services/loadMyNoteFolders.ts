import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { MyNoteFolderProps } from "../../../../types/notes";

// Resolves to [] on any failure so the sidebar degrades to the flat
// (folder-less) tree against an older backend.
export const loadMyNoteFolders = async (
    myself: UserProps,
    accessToken: string | null
): Promise<MyNoteFolderProps[]> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/note/personal/folder/?${query}`);
            return Array.isArray(res.data) ? res.data : [];
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
    return [];
};
