import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

// Deleting a folder moves its contents (child folders + notes) up one
// level on the backend — nothing is lost. Returns true on success.
export const deleteMyNoteFolder = async (
    myself: UserProps,
    folderId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}&folder_id=${folderId}`;
            await api.delete(`/note/personal/folder/?${query}`);
            return true;
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
    return false;
};
