import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

// A page of the roster. The server pages at the size it is asked for (capped at
// 500); 50 pages is far past any real team, and a stop for a server that never
// says it is done.
const PAGE_SIZE = 200;
const MAX_PAGES = 50;

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
        // Follow the server's pages to the end BEFORE returning. The caller
        // stores `serverTime` as its next `since`, so a roster that stopped at
        // the first page would be recorded as complete and its members past the
        // cut would never be fetched (MIP-805).
        const members: TeamMemberDeltaItem[] = [];
        let serverTime: string | undefined;
        let forceFull: boolean | undefined;
        let cursor: string | null = null;
        for (let page = 0; ; page += 1) {
            if (page >= MAX_PAGES) {
                // Throw, so the checkpoint stays where it was and the next sync
                // retries the window instead of recording a short roster.
                throw new Error(`Team roster did not end after ${MAX_PAGES} pages.`);
            }
            const query: string = [
                ...params,
                `limit=${PAGE_SIZE}`,
                ...(cursor ? [`cursor=${encodeURIComponent(cursor)}`] : []),
            ].join("&");
            const res = await api.get(`/team/getTeamMembers/?${query}`);
            members.push(...res.data.data.members);
            // The FIRST page's clock: a later one is later still, and the next
            // `since` would skip a change made while the pages were fetched.
            serverTime ??= res.data.server_time;
            forceFull ??= res.data.force_full_reload;
            // A server that predates paging sends neither key, so one response
            // is the whole roster, exactly as before.
            if (res.data.has_more !== true || typeof res.data.next_cursor !== "string") {
                break;
            }
            cursor = res.data.next_cursor;
        }
        return { serverTime: serverTime as string, members, forceFull };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
