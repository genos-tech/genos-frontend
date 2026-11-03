import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { TeamNoteFolderProps } from "../../../../types/notes";

// Team folders the caller can reach. The server does the ACL walk, so
// every folder in the response is one this user may open.
//
// Resolves undefined when the request fails (or there is no token, or the
// answer is not a list), like `loadMyNoteMeta`. A successful empty list is a
// real answer, "there are no team folders", and stays []. The caller keeps the
// list it has on undefined; resolving [] here emptied the folder tree on every
// failed poll (MIP-961).
export const loadTeamNoteFolders = async (
    myself: UserProps,
    accessToken: string | null
): Promise<TeamNoteFolderProps[] | undefined> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/note/team/folder/?${query}`);
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
