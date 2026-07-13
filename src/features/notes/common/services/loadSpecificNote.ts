import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

export const loadSpecificNote = async (
    myself: UserProps,
    noteType: number,
    noteId: number,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}&note_id=${noteId}`;
            let res: any;
            if (noteType === 1) {
                res = await api.get(`/note/personal/single/?${query}`);
            } else if (noteType === 2) {
                res = await api.get(`/note/task/single/?${query}`);
            } else if (noteType === 3) {
                res = await api.get(`/note/chat/single/?${query}`);
            }
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            // 403 = the note exists but the caller has no role on it —
            // the shared-URL case. Surface it as a typed marker (instead
            // of the generic undefined) so useNoteData can render the
            // "request access" panel rather than a blank editor.
            if (error.response?.status === 403) {
                return { error: "forbidden" };
            }
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
