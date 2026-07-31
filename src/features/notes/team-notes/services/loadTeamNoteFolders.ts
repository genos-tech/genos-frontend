import axios from "axios";

import { authApi } from "../../../../services/api";
import { UserProps } from "../../../../types/admin";
import { TeamNoteFolderProps } from "../../../../types/notes";

// Team folders the caller can reach. The server does the ACL walk, so
// every folder in the response is one this user may open.
//
// Resolves to [] on any failure so the sidebar degrades to an empty
// Team Notes section rather than breaking, matching
// `loadMyNoteFolders`.
export const loadTeamNoteFolders = async (
    myself: UserProps,
    accessToken: string | null
): Promise<TeamNoteFolderProps[]> => {
    try {
        const api = authApi(accessToken);
        if (api) {
            const query = `team_id=${myself.teamId}&user_id=${myself.userId}`;
            const res = await api.get(`/note/team/folder/?${query}`);
            return Array.isArray(res.data) ? res.data : [];
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
