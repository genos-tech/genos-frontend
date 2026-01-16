import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { ChatNoteMetaProps, MyNoteMetaProps, TaskNoteMetaProps } from "../../../../types/notes";

export interface FavoriteNotesMetaResponse {
    personalNotes: MyNoteMetaProps[];
    taskNotes: TaskNoteMetaProps[];
    chatNotes: ChatNoteMetaProps[];
}

export const loadFavoriteNotesMeta = async (
    myself: UserProps,
    accessToken: string | null
): Promise<FavoriteNotesMetaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/note/favorite/meta/?${query}`);
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
