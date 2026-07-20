/**
 * Channel cache warming.
 *
 * Opening a chat paints instantly *if* its messages are already in the
 * in-memory snapshot (`readV3CachedMessages`). They are only there for a
 * channel that has been synced — this session, or in a previous one via
 * `hydrateFromIDB`. Nothing ever warmed a channel the user hadn't opened,
 * so the first open of any chat showed a blank pane for the full cold
 * `syncChannel` round-trip (three parallel REST calls: messages delta,
 * threads delta, member roster — no `since` checkpoint on a cold channel).
 * That was the ~1s "click a chat, stare at nothing" lag.
 *
 * This module warms channels *before* the click, from two triggers:
 *
 *   - `prefetchChannel` on sidebar row hover — the user tells us what
 *     they're about to open, and we spend exactly one sync on it.
 *   - `warmRecentChannels` at boot — the handful of chats someone
 *     actually ping-pongs between, synced during idle time.
 *
 * Both are deliberately stingy about requests: this codebase has a
 * documented history of request storms, so every path here dedupes
 * against work already done and the boot warm-up is capped and
 * concurrency-limited rather than firing the whole channel list.
 */

import { channelService } from "./channelService";

/** Channels we've already asked to sync this session. */
const requested = new Set<string>();

/** How many channels the boot warm-up will touch, most-recent first. */
const DEFAULT_WARM_LIMIT = 10;

/** Concurrent syncs during the boot warm-up. Each is 2-3 REST calls, so
 *  keep this low — the point is to be invisible, not to race the user. */
const DEFAULT_WARM_CONCURRENCY = 2;

/**
 * True when the channel's messages are already in memory, so opening it
 * would paint immediately. A channel with a genuinely empty history
 * reads as cold and may be re-synced once — harmless, and far better
 * than treating "no messages" as "already warm" and never warming it.
 */
export function isChannelWarm(channelId: string): boolean {
    if (!channelId) return false;
    const snapshot = channelService.getSnapshot();
    return (snapshot.messagesByChannel.get(channelId)?.length ?? 0) > 0;
}

/**
 * Sync one channel unless it's already warm or already requested.
 * Fire-and-forget: callers are latency hints, not correctness paths.
 *
 * A failed sync is un-marked so a later hover (or the click itself) can
 * retry rather than being permanently written off.
 */
export function prefetchChannel(channelId: string): void {
    if (!channelId || requested.has(channelId)) return;
    if (isChannelWarm(channelId)) {
        // Nothing to fetch, but remember it so repeated hovers over an
        // already-cached row don't re-enter this check every time.
        requested.add(channelId);
        return;
    }
    requested.add(channelId);
    void channelService.syncChannel(channelId).catch(() => {
        requested.delete(channelId);
    });
}

/** Run `fn` when the browser is idle, falling back to a timeout on
 *  Safari (no `requestIdleCallback`). Returns a canceller. */
function onIdle(fn: () => void, timeoutMs = 2000): () => void {
    const ric = (
        globalThis as unknown as {
            requestIdleCallback?: (cb: () => void, opts?: { timeout: number }) => number;
            cancelIdleCallback?: (handle: number) => void;
        }
    ).requestIdleCallback;
    if (typeof ric === "function") {
        const handle = ric(fn, { timeout: timeoutMs });
        return () => {
            (
                globalThis as unknown as { cancelIdleCallback?: (h: number) => void }
            ).cancelIdleCallback?.(handle);
        };
    }
    const handle = setTimeout(fn, 200);
    return () => clearTimeout(handle);
}

/**
 * Warm the most recently active channels in the background.
 *
 * `channelIds` should already be in the caller's display order (most
 * recent first) — this takes the first `limit` still-cold ones and syncs
 * them `concurrency` at a time, each batch scheduled on an idle callback
 * so the warm-up yields to anything the user is actually doing.
 *
 * Returns a canceller that stops further batches; syncs already in
 * flight are left alone (they're idempotent and their results are worth
 * keeping either way).
 */
export function warmRecentChannels(
    channelIds: readonly string[],
    opts?: { limit?: number; concurrency?: number }
): () => void {
    const limit = opts?.limit ?? DEFAULT_WARM_LIMIT;
    const concurrency = opts?.concurrency ?? DEFAULT_WARM_CONCURRENCY;

    const queue = channelIds
        .filter((id) => id && !requested.has(id) && !isChannelWarm(id))
        .slice(0, limit);

    if (queue.length === 0) return () => {};

    let cancelled = false;
    let cancelIdle: (() => void) | null = null;

    const pump = () => {
        if (cancelled) return;
        const batch = queue.splice(0, concurrency);
        if (batch.length === 0) return;

        void Promise.allSettled(
            batch.map((id) => {
                requested.add(id);
                return channelService.syncChannel(id).catch((e) => {
                    requested.delete(id);
                    throw e;
                });
            })
        ).then(() => {
            if (!cancelled && queue.length > 0) cancelIdle = onIdle(pump);
        });
    };

    cancelIdle = onIdle(pump);

    return () => {
        cancelled = true;
        cancelIdle?.();
    };
}

/** Test seam — drops the session's dedupe memory. */
export function __resetChannelPrefetchForTests(): void {
    requested.clear();
}
