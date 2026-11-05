import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { SharedNoteMetaProps } from "../../../../types/notes";

// Resolves undefined when the request fails (or there is no token, or the
// answer is not a list), like `loadMyNoteMeta`. A successful empty list is a
// real answer and stays []. The caller keeps the list it has on undefined
// (MIP-954).
export const loadSharedNotesMeta = async (
    myself: UserProps,
    accessToken: string | null
): Promise<SharedNoteMetaProps[] | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/note/personal/shared/meta/?${query}`);
            return Array.isArray(res.data) ? (res.data as SharedNoteMetaProps[]) : undefined;
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
    return undefined;
};
