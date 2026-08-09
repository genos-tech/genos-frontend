import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

// `isDeleted` is only present on incremental responses (rows the client
// should evict). Otherwise the shape matches UserProps as it's stored
// in IDB.
export interface TeamMemberDeltaItem extends UserProps {
    isDeleted?: boolean;
}

export interface TeamMembersDeltaResponse {
    serverTime: string;
    members: TeamMemberDeltaItem[];
    forceFull?: boolean;
}

export const loadTeamMembers = async (
    myself: UserProps,
    accessToken: string | null,
    since: string | null
): Promise<TeamMembersDeltaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Authentication token was not found.");
            return;
        }
        const params: string[] = [
            `team_id=${myself.teamId}`,
            `team_name=${myself.teamName}`,
            `user_id=${myself.userId}`,
        ];
        if (since) {
            params.push(`since=${encodeURIComponent(since)}`);
        }
        const res = await api.get(`/team/getTeamMembers/?${params.join("&")}`);
        return {
            serverTime: res.data.server_time,
            members: res.data.data.members,
            forceFull: res.data.force_full_reload,
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
