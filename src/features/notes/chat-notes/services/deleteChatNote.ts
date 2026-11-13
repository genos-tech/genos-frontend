import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

/**
 * Deletes the note on the server. Resolves true when it is gone and false when it was not
 * (no token, a refusal, a network error: the cause is logged); a 404 means it was
 * already gone and counts as true. Callers must clear the note from
 * the client only on true (MIP-1435); this used to resolve the response body, which is also
 * empty on a successful 204 and undefined on a failure, so a failed delete looked like a win.
 */
export const deleteChatNote = async (
    myself: UserProps,
    noteId: number,
    accessToken: string | null
): Promise<boolean> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&user_id=${myself.userId}&note_id=${noteId}`;
            await api.delete(`/note/chat/?${query}`);
            return true;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            return false;
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            // Already gone (deleted in another tab or by someone else): the client should let go.
            if (error.response?.status === 404) return true;
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        return false;
    }
};
