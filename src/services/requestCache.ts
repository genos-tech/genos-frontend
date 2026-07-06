// Module-scope response cache with in-flight promise dedup.
//
// Generalises the pattern already used by `prStatusCache.ts` /
// `taskStatusCache.ts` (Map + TTL) and adds the piece those lack:
// concurrent callers for the same key share ONE network request
// instead of stacking duplicates. That absorbs the burst patterns the
// task-preview loaders hit constantly — rapid preview switching,
// StrictMode double-effects, several components mounting for the same
// task — where the same GET fired 2–10× within a few hundred ms.
//
// Semantics:
// - `ttlMs > 0`: resolved payloads are served from cache until the TTL
//   expires or the key is invalidated.
// - `ttlMs === 0`: dedup-only mode — concurrent calls share the
//   in-flight promise, but every sequential call refetches. Use this
//   for data whose refresh triggers carry no invalidation signal.
// - Rejected fetches are never cached; the in-flight slot is cleared
//   so the next call retries.
// - Cached payloads are shared references: consumers must treat them
//   as immutable (the standard React contract) — copy before mutating.

type CacheEntry<T> = { fetchedAt: number; payload: T };

export type RequestCache<T> = {
    get(key: string, fetcher: () => Promise<T>, opts?: { forceRefresh?: boolean }): Promise<T>;
    invalidate(prefix: string): void;
    clear(): void;
};

export const createRequestCache = <T>(opts: { ttlMs: number }): RequestCache<T> => {
    const cache = new Map<string, CacheEntry<T>>();
    const inflight = new Map<string, Promise<T>>();

    return {
        get(key, fetcher, o) {
            if (!o?.forceRefresh) {
                if (opts.ttlMs > 0) {
                    const hit = cache.get(key);
                    if (hit && Date.now() - hit.fetchedAt < opts.ttlMs) {
                        return Promise.resolve(hit.payload);
                    }
                }
                const pending = inflight.get(key);
                if (pending) return pending;
            }
            const p: Promise<T> = fetcher()
                .then((payload) => {
                    // Cache only while still the registered fetch for
                    // this key: an invalidate() or forceRefresh that
                    // raced us means this payload is already stale.
                    if (opts.ttlMs > 0 && inflight.get(key) === p) {
                        cache.set(key, { fetchedAt: Date.now(), payload });
                    }
                    return payload;
                })
                .finally(() => {
                    // Only clear our own slot — a forceRefresh fetch
                    // must not evict a newer in-flight request.
                    if (inflight.get(key) === p) inflight.delete(key);
                });
            inflight.set(key, p);
            return p;
        },
        invalidate(prefix) {
            for (const k of cache.keys()) {
                if (k.startsWith(prefix)) cache.delete(k);
            }
            // Drop matching in-flight slots too: their eventual payload
            // predates the invalidation, so later callers must refetch
            // (the promise still resolves for its original waiters).
            for (const k of inflight.keys()) {
                if (k.startsWith(prefix)) inflight.delete(k);
            }
        },
        clear() {
            cache.clear();
            inflight.clear();
        },
    };
};
