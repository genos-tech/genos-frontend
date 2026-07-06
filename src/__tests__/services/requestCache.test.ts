import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { createRequestCache } from "../../services/requestCache";

describe("createRequestCache", () => {
    beforeEach(() => {
        vi.useFakeTimers();
    });

    afterEach(() => {
        vi.useRealTimers();
    });

    it("serves cached payloads within the TTL and refetches after expiry", async () => {
        const cache = createRequestCache<string>({ ttlMs: 1000 });
        const fetcher = vi.fn().mockResolvedValue("payload");

        expect(await cache.get("k", fetcher)).toBe("payload");
        expect(await cache.get("k", fetcher)).toBe("payload");
        expect(fetcher).toHaveBeenCalledTimes(1);

        vi.advanceTimersByTime(1001);
        expect(await cache.get("k", fetcher)).toBe("payload");
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("collapses concurrent calls for the same key into one fetch", async () => {
        const cache = createRequestCache<number>({ ttlMs: 1000 });
        let resolveFetch!: (n: number) => void;
        const fetcher = vi.fn(() => new Promise<number>((resolve) => (resolveFetch = resolve)));

        const a = cache.get("k", fetcher);
        const b = cache.get("k", fetcher);
        resolveFetch(7);

        expect(await a).toBe(7);
        expect(await b).toBe(7);
        expect(fetcher).toHaveBeenCalledTimes(1);
    });

    it("dedups concurrent calls but never caches when ttlMs is 0", async () => {
        const cache = createRequestCache<number>({ ttlMs: 0 });
        let resolveFetch!: (n: number) => void;
        const fetcher = vi.fn(() => new Promise<number>((resolve) => (resolveFetch = resolve)));

        const a = cache.get("k", fetcher);
        const b = cache.get("k", fetcher);
        resolveFetch(1);
        expect(await a).toBe(1);
        expect(await b).toBe(1);
        expect(fetcher).toHaveBeenCalledTimes(1);

        resolveFetch = undefined as never;
        const c = cache.get("k", fetcher);
        resolveFetch(2);
        expect(await c).toBe(2);
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("does not cache rejections and retries on the next call", async () => {
        const cache = createRequestCache<string>({ ttlMs: 1000 });
        const fetcher = vi
            .fn()
            .mockRejectedValueOnce(new Error("boom"))
            .mockResolvedValueOnce("recovered");

        await expect(cache.get("k", fetcher)).rejects.toThrow("boom");
        expect(await cache.get("k", fetcher)).toBe("recovered");
        expect(fetcher).toHaveBeenCalledTimes(2);
    });

    it("invalidates cached entries by prefix", async () => {
        const cache = createRequestCache<string>({ ttlMs: 60_000 });
        const fetcher = vi.fn().mockResolvedValue("v");

        await cache.get("activity:1:a", fetcher);
        await cache.get("activity:2:a", fetcher);
        expect(fetcher).toHaveBeenCalledTimes(2);

        cache.invalidate("activity:1:");
        await cache.get("activity:1:a", fetcher); // refetch
        await cache.get("activity:2:a", fetcher); // still cached
        expect(fetcher).toHaveBeenCalledTimes(3);
    });

    it("does not let an in-flight fetch overwrite the cache after invalidation", async () => {
        const cache = createRequestCache<string>({ ttlMs: 60_000 });
        let resolveStale!: (s: string) => void;
        const staleFetcher = vi.fn(
            () => new Promise<string>((resolve) => (resolveStale = resolve))
        );

        const stale = cache.get("k", staleFetcher);
        cache.invalidate("k");
        resolveStale("stale");
        expect(await stale).toBe("stale"); // original waiter still resolves

        // Next call must hit the network, not a cache poisoned post-invalidate.
        const fresh = vi.fn().mockResolvedValue("fresh");
        expect(await cache.get("k", fresh)).toBe("fresh");
        expect(fresh).toHaveBeenCalledTimes(1);
    });

    it("forceRefresh bypasses both cache and in-flight dedup", async () => {
        const cache = createRequestCache<string>({ ttlMs: 60_000 });
        const fetcher = vi.fn().mockResolvedValue("v1");

        await cache.get("k", fetcher);
        const refreshed = vi.fn().mockResolvedValue("v2");
        expect(await cache.get("k", refreshed, { forceRefresh: true })).toBe("v2");
        expect(await cache.get("k", fetcher)).toBe("v2"); // newest payload cached
        expect(fetcher).toHaveBeenCalledTimes(1);
    });
});
