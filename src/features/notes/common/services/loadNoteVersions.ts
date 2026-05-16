import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { NoteVersionMeta } from "../../../../types/notes";

export const loadNoteVersions = async (
    myself: UserProps,
    noteType: number,
    noteId: number,
    accessToken: string | null
): Promise<NoteVersionMeta[]> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&note_type=${noteType}&note_id=${noteId}`;
            const res = await api.get(`/note/version/all/?${query}`);
            return res.data as NoteVersionMeta[];
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
