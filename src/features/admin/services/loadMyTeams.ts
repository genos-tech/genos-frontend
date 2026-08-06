import axios from "axios";

import { getMessages } from "../../../i18n";
import { authApi } from "../../../services/api";
import { Team } from "../../../types/admin";

/**
 * The teams a user actually belongs to.
 *
 * `getMyTeams` also returns shells for host teams in other organizations
 * that shared a chat, project or note folder with us (`isGuest`). Whatever
 * they shared already surfaces inside the user's own team, so entering the
 * shell shows nothing new — every team picker filters them out through
 * here rather than each keeping its own predicate.
 */
export const membershipTeams = (teams: Team[] | undefined): Team[] =>
    (teams ?? []).filter((team) => !team.isGuest);

export const loadMyTeams = async (
    accessToken: string | null,
    userId: string,
    setErrorMessage?: (value: string) => void
) => {
    try {
        const api = authApi(accessToken);
        const query = `user_id=${userId}`;
        if (api) {
            const res = await api.get(`/team/getMyTeams/?${query}`);
            return res.data;
        } else {
            console.error("Unauthorized. Auth toke is not found.");
            if (setErrorMessage) {
                setErrorMessage(getMessages().admin.auth.errors.tokenMissing);
            }
        }
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
