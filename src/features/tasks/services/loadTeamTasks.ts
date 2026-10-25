import axios from "axios";

import { authApi } from "../../../services/api";
import { UserProps } from "../../../types/admin";

// A page of the team's tasks. The server caps a page at 1000; 100 pages is far
// past any real team, and a stop for a server that never says it is done.
const PAGE_SIZE = 500;
const MAX_PAGES = 100;

// Every task the caller can see in the team, or `undefined` if the load failed.
//
// It follows the server's pages to the end BEFORE returning, and a failure on
// any page returns `undefined` for the whole load rather than the pages so far:
// callers reconcile a local store against this list (the team load empties it
// first), so a list that stopped early would evict whatever was past the cut
// (MIP-807).
export const loadTeamTasks = async (myself: UserProps, accessToken: string | null) => {
    try {
        const api = authApi(accessToken);
        if (!api) {
            console.error("Unauthorized. Auth toke is not found.");
            return;
        }
        const team = `team_id=${myself.teamId}`;
        const tasks: unknown[] = [];
        let cursor: string | null = null;
        for (let page = 0; ; page += 1) {
            if (page >= MAX_PAGES) {
                throw new Error(`Team tasks did not end after ${MAX_PAGES} pages.`);
            }
            const query: string = [
                team,
                `limit=${PAGE_SIZE}`,
                ...(cursor ? [`cursor=${encodeURIComponent(cursor)}`] : []),
            ].join("&");
            let res;
            try {
                res = await api.get(`/task/getTeamTasksPage/?${query}`);
            } catch (error: unknown) {
                // A server that predates the paged route has no such URL. Its
                // old route returns everything in one bare array, which is the
                // whole list, so use that instead of failing the load.
                if (page === 0 && axios.isAxiosError(error) && error.response?.status === 404) {
                    const legacy = await api.get(`/task/getTeamTasks/?${team}`);
                    return legacy.data;
                }
                throw error;
            }
            tasks.push(...res.data.tasks);
            if (res.data.has_more !== true || typeof res.data.next_cursor !== "string") {
                break;
            }
            cursor = res.data.next_cursor;
        }
        return tasks;
    } catch (error: unknown) {
        if (axios.isAxiosError(error)) {
            console.error("API error:", error.response?.status, error.response?.data);
        } else {
            console.error("Unexpected error:", error);
        }
    }
};
