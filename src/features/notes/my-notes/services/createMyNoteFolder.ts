import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { MyNoteFolderProps } from "../../../../types/notes";

export const createMyNoteFolder = async (
    myself: UserProps,
    name: string,
    parentFolderId: number | null,
    accessToken: string | null
): Promise<MyNoteFolderProps | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const res = await api.post("/note/personal/folder/", {
                team_id: myself.teamId,
                user_id: myself.userId,
                name: name,
                parent_folder_id: parentFolderId,
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
