import { useEffect, useState } from "react";

import { getCachedOrFetchPrStatus, type PrStatusResult } from "../services/prStatusCache";
import type { PrDetailResponse } from "../services/prTypes";

/**
 * A PR's detail, fetched the first time `ask` is called (a hover or a focus)
 * and never before: opening a task with a dozen PRs must not send a dozen
 * GitHub-backed requests (three GitHub calls each on the server).
 *
 * `ask` latches: calling it again does nothing, and a failed lookup is not
 * retried on the next hover. `detail` is the payload once it has landed, and
 * stays `null` for a failure or for a user without GitHub connected, so a
 * caller keeps showing what it already had. The request itself is shared with
 * every other consumer through `prStatusCache`.
 */
export const useLazyPrDetail = (
    accessToken: string | null | undefined,
    url: string | null | undefined
): { detail: PrDetailResponse | null; ask: () => void } => {
    const [asked, setAsked] = useState(false);
    const [result, setResult] = useState<PrStatusResult | null>(null);

    useEffect(() => {
        if (!asked || !accessToken || !url) return;
        let cancelled = false;
        void (async () => {
            const r = await getCachedOrFetchPrStatus(accessToken, url);
            if (!cancelled) setResult(r);
        })();
        return () => {
            cancelled = true;
        };
    }, [asked, accessToken, url]);

    return {
        detail: result?.kind === "ok" ? (result.payload as PrDetailResponse) : null,
        ask: () => setAsked(true),
    };
};
