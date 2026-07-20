/**
 * Channel cache-warming tests.
 *
 * `channelPrefetch` exists to stop a cold chat open from blanking the
 * pane for a full `syncChannel` round-trip. Its whole job is spending
 * syncs *early* without spending them *twice* — this codebase has a
 * documented request-storm history, so the dedupe and the concurrency
 * cap are the behaviours worth pinning down.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    __resetChannelPrefetchForTests,
    isChannelWarm,
    prefetchChannel,
    warmRecentChannels,
} from "../services/channel/channelPrefetch";
import { channelService } from "../services/channel/channelService";

vi.mock("../db/config/schema", () => ({
    initDB: vi.fn().mockRejectedValue(new Error("IDB stubbed off in tests")),
}));

/** Point the service's snapshot at a fixed set of cached channels. */
function stubSnapshot(warmChannelIds: string[]) {
    const messagesByChannel = new Map<string, unknown[]>();
    for (const id of warmChannelIds) {
        messagesByChannel.set(id, [{ id: `${id}-m1` }]);
    }
    return vi
        .spyOn(channelService, "getSnapshot")
        .mockReturnValue({ messagesByChannel } as unknown as ReturnType<
            typeof channelService.getSnapshot
        >);
}

describe("channelPrefetch", () => {
    let syncSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
        __resetChannelPrefetchForTests();
        // Idle callbacks run inline so the warm-up drains synchronously.
        vi.stubGlobal("requestIdleCallback", (cb: () => void) => {
            cb();
            return 1;
        });
        vi.stubGlobal("cancelIdleCallback", () => {});
        syncSpy = vi
            .spyOn(channelService, "syncChannel")
            .mockImplementation(() => Promise.resolve());
    });

    afterEach(() => {
        vi.restoreAllMocks();
        vi.unstubAllGlobals();
    });

    describe("isChannelWarm", () => {
        it("is true only for a channel with cached messages", () => {
            stubSnapshot(["warm-1"]);
            expect(isChannelWarm("warm-1")).toBe(true);
            expect(isChannelWarm("cold-1")).toBe(false);
            expect(isChannelWarm("")).toBe(false);
        });
    });

    describe("prefetchChannel", () => {
        it("syncs a cold channel", () => {
            stubSnapshot([]);
            prefetchChannel("cold-1");
            expect(syncSpy).toHaveBeenCalledExactlyOnceWith("cold-1");
        });

        it("does not sync a channel already in the cache", () => {
            stubSnapshot(["warm-1"]);
            prefetchChannel("warm-1");
            expect(syncSpy).not.toHaveBeenCalled();
        });

        it("syncs a given channel only once, however many hovers", () => {
            stubSnapshot([]);
            prefetchChannel("cold-1");
            prefetchChannel("cold-1");
            prefetchChannel("cold-1");
            expect(syncSpy).toHaveBeenCalledTimes(1);
        });

        it("ignores an empty channel id", () => {
            stubSnapshot([]);
            prefetchChannel("");
            expect(syncSpy).not.toHaveBeenCalled();
        });

        it("lets a later hover retry after a failed sync", async () => {
            stubSnapshot([]);
            syncSpy.mockImplementationOnce(() => Promise.reject(new Error("offline")));

            prefetchChannel("cold-1");
            // Let the rejection settle so the dedupe entry is released.
            await Promise.resolve();
            await Promise.resolve();

            prefetchChannel("cold-1");
            expect(syncSpy).toHaveBeenCalledTimes(2);
        });
    });

    describe("warmRecentChannels", () => {
        it("warms no more than `limit` channels", async () => {
            stubSnapshot([]);
            const ids = Array.from({ length: 25 }, (_, i) => `c-${i}`);

            warmRecentChannels(ids, { limit: 5, concurrency: 5 });
            await vi.waitFor(() => expect(syncSpy).toHaveBeenCalledTimes(5));

            // Respects the caller's order (most-recent-first).
            expect(syncSpy.mock.calls.map((c) => c[0])).toEqual([
                "c-0",
                "c-1",
                "c-2",
                "c-3",
                "c-4",
            ]);
        });

        it("skips channels that are already cached", async () => {
            stubSnapshot(["c-1"]);
            warmRecentChannels(["c-0", "c-1", "c-2"], { limit: 10, concurrency: 3 });
            await vi.waitFor(() => expect(syncSpy).toHaveBeenCalledTimes(2));
            expect(syncSpy.mock.calls.map((c) => c[0])).toEqual(["c-0", "c-2"]);
        });

        it("does not re-sync what a hover already claimed", async () => {
            stubSnapshot([]);
            prefetchChannel("c-1");
            expect(syncSpy).toHaveBeenCalledTimes(1);

            warmRecentChannels(["c-0", "c-1"], { limit: 10, concurrency: 2 });
            await vi.waitFor(() => expect(syncSpy).toHaveBeenCalledTimes(2));
            expect(syncSpy.mock.calls.map((c) => c[0])).toEqual(["c-1", "c-0"]);
        });

        it("drains in batches no larger than `concurrency`", async () => {
            stubSnapshot([]);
            let inFlight = 0;
            let peak = 0;
            syncSpy.mockImplementation(() => {
                inFlight += 1;
                peak = Math.max(peak, inFlight);
                return Promise.resolve().then(() => {
                    inFlight -= 1;
                });
            });

            warmRecentChannels(["a", "b", "c", "d", "e", "f"], { limit: 6, concurrency: 2 });
            await vi.waitFor(() => expect(syncSpy).toHaveBeenCalledTimes(6));
            expect(peak).toBeLessThanOrEqual(2);
        });

        it("stops scheduling further batches once cancelled", async () => {
            stubSnapshot([]);
            const cancel = warmRecentChannels(["a", "b", "c", "d", "e", "f"], {
                limit: 6,
                concurrency: 2,
            });
            cancel();
            await Promise.resolve();
            await Promise.resolve();
            // The first batch may already have gone out; nothing beyond it.
            expect(syncSpy.mock.calls.length).toBeLessThanOrEqual(2);
        });

        it("is a no-op when everything is already warm", () => {
            stubSnapshot(["a", "b"]);
            warmRecentChannels(["a", "b"], { limit: 10 });
            expect(syncSpy).not.toHaveBeenCalled();
        });
    });
});
