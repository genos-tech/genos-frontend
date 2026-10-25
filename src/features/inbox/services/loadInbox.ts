import axios from "axios";

import { authApi } from "../../../services/api";
import { InboxItemProps } from "../../../types/common";

// A page of the inbox. The server pages at the size it is asked for (capped at
// 500); 50 pages is far past any real inbox, and a stop for a server that never
// says it is done.
const PAGE_SIZE = 200;
const MAX_PAGES = 50;

// Wire shape mirrors the backend's delta envelope; `isDeleted` is only
// present on incremental responses (rows the client should evict).
export interface InboxDeltaItem extends InboxItemProps {
    isDeleted?: boolean;
}

export interface InboxDeltaResponse {
    serverTime: string;
    items: InboxDeltaItem[];
    forceFull?: boolean;
}

export const loadInbox = async (
    teamId: string,
    userId: string,
    accessToken: string | null,
    since: string | null
): Promise<InboxDeltaResponse | undefined> => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Authentication token was not found.");
            return;
        }
        const params: string[] = [`team_id=${teamId}`, `user_id=${userId}`];
        if (since) {
            params.push(`since=${encodeURIComponent(since)}`);
        }
        // Follow the server's pages to the end BEFORE returning. The caller
        // stores `serverTime` as its next `since` and, on a full load, clears the
        // inbox store before inserting what arrived, so an inbox that stopped at
        // the first page would wipe every older item from the client for good
        // (MIP-806).
        const items: InboxDeltaItem[] = [];
        let serverTime: string | undefined;
        let forceFull: boolean | undefined;
        let cursor: string | null = null;
        for (let page = 0; ; page += 1) {
            if (page >= MAX_PAGES) {
                // Throw, so the checkpoint stays where it was and the store is
                // untouched, instead of recording a short inbox as complete.
                throw new Error(`Inbox did not end after ${MAX_PAGES} pages.`);
            }
            const query: string = [
                ...params,
                `limit=${PAGE_SIZE}`,
                ...(cursor ? [`cursor=${encodeURIComponent(cursor)}`] : []),
            ].join("&");
            const res = await api.get(`/inbox/?${query}`);
            items.push(...res.data.data.items);
            // The FIRST page's clock: a later one is later still, and the next
            // `since` would skip a change made while the pages were fetched.
            serverTime ??= res.data.server_time;
            forceFull ??= res.data.force_full_reload;
            // A server that predates paging sends neither key, so one response
            // is the whole inbox, exactly as before.
            if (res.data.has_more !== true || typeof res.data.next_cursor !== "string") {
                break;
            }
            cursor = res.data.next_cursor;
        }
        return { serverTime: serverTime as string, items, forceFull };
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
