import axios from "axios";

import { v3ApiBaseURL } from "../../../services/v3Api";
import { UserProps } from "../../../types/admin";
import { SearchListProps } from "../../../types/chat";

/**
 * Chat-search data source. Hits the v3 endpoint
 * `GET /api/v3/search/teamMembersAndGroups/?team_id=` (the legacy
 * `/api/v2/search/teamMembersAndGroups/` was deleted with the v2 chat
 * REST, which left this returning 404 → an empty search box).
 *
 * Like the other v3 REST calls we CANNOT use `authApi(...)` — its
 * baseURL ends in `/api/v2/`. `v3ApiBaseURL()` is the Django host root
 * so the path lands on `/api/v3/` cleanly.
 *
 * Returns `[]` (never undefined) on any failure so the caller's
 * `setOptions([...result])` spread can't throw.
 */
export const loadSearchList = async (
    myself: UserProps,
    accessToken: string | null
): Promise<SearchListProps[]> => {
    try {
        if (!accessToken) {
            console.error("Unauthorized. Auth token is not found.");
            return [];
        }
        const url = `${v3ApiBaseURL()}/api/v3/search/teamMembersAndGroups/?team_id=${encodeURIComponent(
            myself.teamId
        )}`;
        const res = await axios.get(url, {
            headers: { Authorization: `Bearer ${accessToken}` },
            withCredentials: true,
        });
        return Array.isArray(res.data?.results) ? (res.data.results as SearchListProps[]) : [];
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
        return [];
    }
};
