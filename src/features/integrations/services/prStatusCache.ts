import { createRequestCache } from "../../../services/requestCache";
import { parsePrUrl } from "../utils/parsePrUrl";
import { getPullDetail } from "./github";
import type { PrDetailResponse } from "./prTypes";

// Per-task PR-status memo, keyed by canonical PR URL. Short TTL so a
// rapid task-toggle doesn't spam GitHub but reopening after ~a minute
// fetches fresh data. Module-scope is deliberate: this is a session-wide
// cache shared across mounts of LinkedPrCard, not React state.
//
// Callers that ask for the same PR while its request is still in flight
// share that ONE request (`createRequestCache`). Opening a task asks for each
// linked PR from the table's PR column (`PrStatusCell`) and from the task
// preview (`LinkedPrCard`) at the same moment, and until now each of them
// sent its own call: every one of those is three GitHub calls on the server.
// Only an `ok` answer is kept for the TTL; "GitHub not connected", "private or
// deleted" and errors are shared by whoever was waiting, then the next call asks again.
const TTL_MS = 60_000;
const memo = createRequestCache<PrDetailResponse>({ ttlMs: TTL_MS });

export type PrStatusResult =
    | { kind: "ok"; payload: PrDetailResponse }
    | { kind: "github_not_connected" }
    // GitHub refused this account the PR (404/403): deleted, or private to a
    // repo it cannot see. Asking again cannot help, so there is no Retry.
    | { kind: "unavailable" }
    // Anything else: a dropped connection, a 5xx, a rate limit. May pass.
    | { kind: "error" };

// The shared cache stores what a fetch RESOLVES to and drops what it rejects,
// so a failed lookup leaves the fetch by throwing this: everyone waiting on
// the same request gets the answer, and nothing is stored.
class PrStatusMiss extends Error {
    constructor(readonly result: Exclude<PrStatusResult, { kind: "ok" }>) {
        super(result.kind);
    }
}

export const getCachedOrFetchPrStatus = async (
    accessToken: string,
    url: string,
    setErrorMessage?: (m: string) => void,
    // The PR column's re-sync (MIP-1409) asks again past the memo. A refused or failed
    // fetch is not stored, so a good entry that is still within its TTL survives it.
    options?: { forceRefresh?: boolean }
): Promise<PrStatusResult> => {
    const ref = parsePrUrl(url);
    if (!ref) return { kind: "error" };

    try {
        // `setErrorMessage` belongs to the request that is actually sent: a
        // caller that joins one already in flight does not get its callback.
        const payload = await memo.get(
            url,
            async () => {
                const res = await getPullDetail(
                    accessToken,
                    ref.owner,
                    ref.repo,
                    ref.number,
                    setErrorMessage
                );
                if (res === "github_not_connected") {
                    throw new PrStatusMiss({ kind: "github_not_connected" });
                }
                if (res === "unavailable") throw new PrStatusMiss({ kind: "unavailable" });
                if (!res) throw new PrStatusMiss({ kind: "error" });
                return res as PrDetailResponse;
            },
            { forceRefresh: options?.forceRefresh }
        );
        return { kind: "ok", payload };
    } catch (e) {
        if (e instanceof PrStatusMiss) return e.result;
        throw e;
    }
};

// Test affordance.
export const clearPrStatusCache = (): void => {
    memo.clear();
};
