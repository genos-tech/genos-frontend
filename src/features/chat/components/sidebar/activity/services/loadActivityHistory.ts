import axios from "axios";

import { v3ApiBaseURL } from "../../../../../../services/v3Api";
import { UserProps } from "../../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../../types/chat";
import { v3ActivityToLegacy } from "../../../../adapters/v3ActivityToLegacy";

const periodDays: number = 30;

export interface ActivityDeltaItem extends ActivityMessageProps {
    isDeleted?: boolean;
}

export interface ActivityDeltaResponse {
    serverTime: string;
    activity: ActivityDeltaItem[];
    forceFull?: boolean;
}

export const loadActivityHistory = async (
    myself: UserProps,
    accessToken: string | null,
    since: string | null
): Promise<ActivityDeltaResponse | undefined> => {
    // v3-native: hits `/api/v3/activities/?since=ISO`. We CANNOT use
    // `authApi(...)` here — its baseURL ends in `/api/v2/` (legacy env
    // var), so a relative `/activities/` resolves to the wrong route.
    // `v3ApiBaseURL()` returns the Django host root so paths land on
    // `/api/v3/` cleanly.
    try {
        if (!accessToken) {
            console.error("Unauthorized. Auth token is not found.");
            return;
        }
        const params: string[] = [];
        if (since) {
            params.push(`since=${encodeURIComponent(since)}`);
        } else {
            const cutoff = new Date(Date.now() - periodDays * 24 * 60 * 60 * 1000).toISOString();
            params.push(`since=${encodeURIComponent(cutoff)}`);
        }
        // Without this the endpoint answers for every team the user
        // belongs to at once, and a two-team user saw the other team's
        // mentions and replies in this team's sidebar.
        if (myself.teamId) {
            params.push(`team_id=${encodeURIComponent(myself.teamId)}`);
        }
        const res = await axios.get(`${v3ApiBaseURL()}/api/v3/activities/?${params.join("&")}`, {
            headers: { Authorization: `Bearer ${accessToken}` },
            withCredentials: true,
        });
        const activities = Array.isArray(res.data?.activities) ? res.data.activities : [];
        return {
            serverTime: res.data.server_time,
            activity: activities.map((a: unknown) =>
                v3ActivityToLegacy(a as Parameters<typeof v3ActivityToLegacy>[0], myself)
            ),
            forceFull: false,
        };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
