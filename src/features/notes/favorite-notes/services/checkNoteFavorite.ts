import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

export interface CheckFavoriteResponse {
    isFavorited: boolean;
}

export const checkNoteFavorite = async (
    myself: UserProps,
    noteId: number,
    noteType: number,
    accessToken: string | null
): Promise<CheckFavoriteResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}&note_id=${noteId}&note_type=${noteType}`;
            const res = await api.get(`/note/favorite/check/?${query}`);
            return res.data;
        } else {
            console.error("Unauthorized. Auth token is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
