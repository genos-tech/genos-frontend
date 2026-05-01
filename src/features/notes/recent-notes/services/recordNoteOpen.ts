import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

export interface RecordNoteOpenResponse {
    message: string;
    noteId: number;
    noteType: number;
    tsOpenedAt: string;
}

export const recordNoteOpen = async (
    myself: UserProps,
    noteId: number,
    noteType: number,
    accessToken: string | null
): Promise<RecordNoteOpenResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/note/recent/", {
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
