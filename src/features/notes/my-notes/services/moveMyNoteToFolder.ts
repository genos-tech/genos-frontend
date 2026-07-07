import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";

// Move a personal note into a folder, or to the My Notes root with an
// explicit `folderId: null`. The backend re-roots the note
// (parent_note_id → null); its child-note subtree rides along. Returns
// the meta-shaped row on success, undefined on failure.
export const moveMyNoteToFolder = async (
    myself: UserProps,
    noteId: number,
    folderId: number | null,
    accessToken: string | null
) => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.put("/note/personal/move/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                note_id: noteId,
                folder_id: folderId,
            });
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
    return undefined;
};
