import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { TeamNoteMetaProps } from "../../../../types/notes";

// Notes filed in team folders the caller can read — including notes
// owned by other people, which is the whole point of the space.
//
// Resolves undefined when the request fails (or there is no token, or the
// answer is not a list), like `loadMyNoteMeta`. A successful empty list is a
// real answer, "there are no team notes", and stays []. The caller keeps the
// list it has on undefined; resolving [] here emptied the sidebar on every
// failed poll (MIP-954).
export const loadTeamNotesMeta = async (
    myself: UserProps,
    accessToken: string | null
): Promise<TeamNoteMetaProps[] | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/note/team/meta/?${query}`);
            return Array.isArray(res.data) ? res.data : undefined;
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
