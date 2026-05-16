import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { NoteVersionDetail } from "../../../../types/notes";

export const loadNoteVersion = async (
    myself: UserProps,
    noteType: number,
    noteId: number,
    versionNo: number,
    accessToken: string | null
): Promise<NoteVersionDetail | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&note_type=${noteType}&note_id=${noteId}&version_no=${versionNo}`;
            const res = await api.get(`/note/version/?${query}`);
            return res.data as NoteVersionDetail;
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
