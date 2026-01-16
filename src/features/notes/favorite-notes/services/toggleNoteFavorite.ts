import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

export interface ToggleFavoriteResponse {
    message: string;
    isFavorited: boolean;
    noteId?: number;
    noteType?: number;
    tsCreated?: string;
}

export const addNoteFavorite = async (
    myself: UserProps,
    noteId: number,
    noteType: number,
    accessToken: string | null
): Promise<ToggleFavoriteResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/note/favorite/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                note_id: noteId,
                note_type: noteType,
            });
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

export const removeNoteFavorite = async (
    myself: UserProps,
    noteId: number,
    noteType: number,
    accessToken: string | null
): Promise<ToggleFavoriteResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}&note_id=${noteId}&note_type=${noteType}`;
            const res = await api.delete(`/note/favorite/?${query}`);
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
