// Thin wrapper around POST /api/v2/search/. Used by the global
// Spotlight overlay (Cmd-K) to fetch search results as the user types.
//
// Cancellable via AbortController so a fast-typing user doesn't pile up
// stale in-flight requests (only the latest one's results should ever
// land in the UI).

import type { SearchRequest, SearchResponse } from "../features/spotlight/types";
import { authApi } from "./api";

export interface SearchSpotlightArgs extends SearchRequest {
    accessToken: string | null;
    signal?: AbortSignal;
}

export async function searchSpotlight({
    accessToken,
    signal,
    ...body
}: SearchSpotlightArgs): Promise<SearchResponse> {
    const client = authApi(accessToken);
    if (!client) {
        // No token: short-circuit to an empty result rather than throwing.
        // AuthContext will independently kick the user back to /signin
        // when needed; the spotlight shouldn't blow up in the meantime.
        return { query: body.query, results: [] };
    }
    const resp = await client.post<SearchResponse>("/search/", body, { signal });
    return resp.data;
}
