import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { MyNoteFolderProps } from "../../../../types/notes";

// Rename and/or move a folder. The backend uses KEY-PRESENCE semantics
// for `parent_folder_id`: include it (even as null → move to root) only
// when a move is intended, so a rename-only call must omit it.
export const updateMyNoteFolder = async (
    myself: UserProps,
    folderId: number,
    changes: { name?: string; parentFolderId?: number | null },
    accessToken: string | null
): Promise<MyNoteFolderProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const payload: Record<string, unknown> = {
                team_id: myself.teamId,
                user_id: myself.userId,
                folder_id: folderId,
            };
            if (changes.name !== undefined) {
                payload.name = changes.name;
            }
            if ("parentFolderId" in changes) {
                payload.parent_folder_id = changes.parentFolderId;
            }
            const res = await api.put("/note/personal/folder/", payload);
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
