import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { NoteRoleMember } from "../../../../types/notes";

export const updateNoteRole = async (
    myself: UserProps,
    noteType: number,
    noteId: number,
    targetUserId: string,
    roleId: number,
    accessToken: string | null
): Promise<NoteRoleMember | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post(`/note/role/`, {
                team_id: myself.teamId,
                note_type: noteType,
                note_id: noteId,
                target_user_id: targetUserId,
                role_id: roleId,
            });
            return res.data as NoteRoleMember;
        } else {
            console.error("Unauthorized. Auth token is not found.");
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
            throw error;
        } else {
            console.error("Unexpected error:", error);
            throw error;
        }
    }
};
