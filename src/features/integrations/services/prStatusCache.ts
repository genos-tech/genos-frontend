import { parsePrUrl } from "../utils/parsePrUrl";
import { getPullDetail } from "./github";
import type { PrDetailResponse } from "./prTypes";

// Per-task PR-status memo, keyed by canonical PR URL. Short TTL so a
// rapid task-toggle doesn't spam GitHub but reopening after ~a minute
// fetches fresh data. Module-scope is deliberate: this is a session-wide
// cache shared across mounts of LinkedPrCard, not React state.
const TTL_MS = 60_000;
const cache = new Map<string, { fetchedAt: number; payload: PrDetailResponse }>();

export type PrStatusResult =
    | { kind: "ok"; payload: PrDetailResponse }
    | { kind: "github_not_connected" }
    | { kind: "error" };

export const getCachedOrFetchPrStatus = async (
    accessToken: string,
    url: string,
    setErrorMessage?: (m: string) => void
): Promise<PrStatusResult> => {
    const ref = parsePrUrl(url);
    if (!ref) return { kind: "error" };

    const hit = cache.get(url);
    if (hit && Date.now() - hit.fetchedAt < TTL_MS) {
        return { kind: "ok", payload: hit.payload };
    }

    const res = await getPullDetail(accessToken, ref.owner, ref.repo, ref.number, setErrorMessage);
    if (res === "github_not_connected") return { kind: "github_not_connected" };
    if (!res) return { kind: "error" };

    const payload = res as PrDetailResponse;
    cache.set(url, { fetchedAt: Date.now(), payload });
    return { kind: "ok", payload };
};

// Test affordance and a future "manual refresh" button hook.
export const clearPrStatusCache = (): void => {
    cache.clear();
};
