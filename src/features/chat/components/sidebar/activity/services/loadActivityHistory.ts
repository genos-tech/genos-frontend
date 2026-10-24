import axios from "axios";

import { v3ApiBaseURL } from "../../../../../../services/v3Api";
import { UserProps } from "../../../../../../types/admin";
import { ActivityMessageProps } from "../../../../../../types/chat";
import { v3ActivityToLegacy } from "../../../../adapters/v3ActivityToLegacy";

const periodDays: number = 30;

// The server pages at 200, so this is 10,000 entries in the 30-day window:
// far past any real feed, and a stop for a server that never says "done".
const MAX_PAGES = 50;

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
        // The server answers with the newest page and, when there is an older
        // one, `has_more` + `next_cursor`. Follow it to the end BEFORE
        // returning: the caller stores `serverTime` as its next `since` and, on
        // a full load, clears the store first, so a partial list would lose
        // everything past the cut for good (MIP-740).
        const base = `${v3ApiBaseURL()}/api/v3/activities/?${params.join("&")}`;
        const activities: unknown[] = [];
        let serverTime: string | undefined;
        let cursor: string | null = null;
        for (let page = 0; ; page += 1) {
            if (page >= MAX_PAGES) {
                // A server that never stops saying `has_more` must not hang the
                // worker. Throwing leaves the checkpoint where it was, so the
                // next sync retries the same window instead of recording a
                // short list as complete.
                throw new Error(`Activity history did not end after ${MAX_PAGES} pages.`);
            }
            const url: string = cursor ? `${base}&cursor=${encodeURIComponent(cursor)}` : base;
            const res = await axios.get(url, {
                headers: { Authorization: `Bearer ${accessToken}` },
                withCredentials: true,
            });
            if (Array.isArray(res.data?.activities)) {
                activities.push(...res.data.activities);
            }
            // The FIRST page's clock, not the last: a later page's is later
            // still, and the next `since` would then skip rows created while
            // the pages were being fetched. Using the first can only re-fetch
            // a row, which the applier's upsert already tolerates.
            serverTime ??= res.data?.server_time;
            // A server that predates the field sends neither key: one page,
            // exactly as before.
            if (res.data?.has_more !== true || typeof res.data?.next_cursor !== "string") {
                break;
            }
            cursor = res.data.next_cursor;
        }
        return {
            serverTime: serverTime as string,
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
