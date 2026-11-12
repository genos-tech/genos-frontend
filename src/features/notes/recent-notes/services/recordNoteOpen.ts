import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { landReadActivityIds } from "../../../chat/services/landReadActivityIds";

export interface RecordNoteOpenResponse {
    message: string;
    noteId: number;
    noteType: number;
    tsOpenedAt: string;
    /** Activity the server marked read because the note was opened (MIP-1421). */
    readActivityIds?: string[];
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
            // The server marked the note's unread activity read (MIP-1421): land it locally.
            landReadActivityIds(res.data);
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
