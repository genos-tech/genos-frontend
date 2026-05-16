import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

export const deleteNoteRole = async (
    myself: UserProps,
    noteType: number,
    noteId: number,
    targetUserId: string,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&note_type=${noteType}&note_id=${noteId}&target_user_id=${targetUserId}`;
            await api.delete(`/note/role/?${query}`);
            return true;
        }
        console.error("Unauthorized. Auth token is not found.");
        return false;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        return false;
    }
};
