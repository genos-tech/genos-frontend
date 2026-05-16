import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { SharedNoteMetaProps } from "../../../../types/notes";

export const loadSharedNotesMeta = async (
    myself: UserProps,
    accessToken: string | null
): Promise<SharedNoteMetaProps[]> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/note/personal/shared/meta/?${query}`);
            return res.data as SharedNoteMetaProps[];
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
    return [];
};
