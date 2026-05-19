import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

export const loadTeamProjects = async (myself: UserProps, accessToken: string | null) => {
    // Skip when the user hasn't joined / been hydrated with a team
    // yet. Otherwise template-literal interpolation turns a
    // null/undefined teamId into the literal string "null", which the
    // backend then crashes on while coercing it to a UUID. Happens
    // briefly on first mount of /workspace/* right after signup (incl.
    // the OAuth flow) before `getMyTeams` populates `myself.teamId`.
    if (!myself.teamId || !myself.userId) {
        return;
    }
    try {
        const api = authApi(accessToken);
        if (api) {
            const query: string = `team_id=${myself.teamId}&attendee_id=${myself.userId}`;
            const res = await api.get(`/project/projects/?${query}`);
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
};
