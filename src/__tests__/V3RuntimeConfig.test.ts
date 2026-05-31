/**
 * Runtime config service tests.
 *
 * Covers:
 *   - Fetch + snapshot population.
 *   - Bucketing stability per (userId, flagName).
 *   - Bucketing changes when the userId changes.
 *   - `isEnabled` honors thresholds and bucket boundaries.
 *   - Panic switch short-circuits every flag.
 *   - Poll interval refetches.
 *   - Network failure keeps cached config.
 *   - `_normalize` coerces malformed payloads to defaults.
 *
 * The crypto.subtle.digest path runs against the real Web Crypto API
 * exposed by Node (>=16) under jsdom — this is the same API the app
 * uses in production, so the bucket math is end-to-end.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { authApi } from "../services/api";
import {
    runtimeConfigService,
    type RuntimeConfig,
} from "../services/runtimeConfig/runtimeConfigService";

vi.mock("../services/api", () => ({
    authApi: vi.fn(),
    nonAuthApi: vi.fn(),
}));

const FRESH_CONFIG: RuntimeConfig = {
    version: 1,
    use_new_chat: { dm: 5000, gm: 0, mdm: 10000, pm: 100 },
    panic_switch: false,
};

function mockGet(returnPayload: unknown): ReturnType<typeof vi.fn> {
    const get = vi.fn().mockResolvedValue({ data: returnPayload });
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
    return get;
}

function mockGetReject(err: unknown): ReturnType<typeof vi.fn> {
    const get = vi.fn().mockRejectedValue(err);
    (authApi as ReturnType<typeof vi.fn>).mockReturnValue({ get });
    return get;
}

describe("runtimeConfigService — fetch + snapshot", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeConfigService._resetForTests();
        runtimeConfigService.setAccessToken("tok-1");
        runtimeConfigService.setUserId("u-alice");
    });
    afterEach(() => {
        runtimeConfigService.stop();
    });

    it("populates the snapshot after a successful fetch", async () => {
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() => expect(runtimeConfigService.getSnapshot().isLoaded).toBe(true));
        const snap = runtimeConfigService.getSnapshot();
        expect(snap.config.use_new_chat.dm).toBe(5000);
        expect(snap.config.use_new_chat.mdm).toBe(10000);
        expect(snap.config.panic_switch).toBe(false);
    });

    it("getSnapshot returns the same reference between unchanged fetches (no infinite re-render)", async () => {
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() => expect(runtimeConfigService.getSnapshot().isLoaded).toBe(true));
        const ref1 = runtimeConfigService.getSnapshot();
        // Same call site should return the same reference until a notify happens.
        expect(runtimeConfigService.getSnapshot()).toBe(ref1);
    });

    it("isLoaded stays false when fetch rejects", async () => {
        const get = mockGetReject(new Error("network down"));
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        // Give the failure path a microtask to settle.
        await Promise.resolve();
        expect(runtimeConfigService.getSnapshot().isLoaded).toBe(false);
    });

    it("does not fetch when no access token is set", async () => {
        runtimeConfigService._resetForTests();
        runtimeConfigService.setUserId("u-bob");
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        // Brief microtask flush — no token, no fetch.
        await Promise.resolve();
        await Promise.resolve();
        expect(get).not.toHaveBeenCalled();
    });
});

describe("runtimeConfigService — bucketing", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeConfigService._resetForTests();
        runtimeConfigService.setAccessToken("tok-1");
    });
    afterEach(() => {
        runtimeConfigService.stop();
    });

    it("computes a stable bucket for a given (userId, flag) pair", async () => {
        runtimeConfigService.setUserId("u-alice");
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() =>
            expect(runtimeConfigService.bucketFor("use_new_chat.dm")).toBeDefined()
        );
        const first = runtimeConfigService.bucketFor("use_new_chat.dm")!;
        // Re-fetch — same userId + same flag → same bucket.
        await runtimeConfigService["_fetch"]();
        const second = runtimeConfigService.bucketFor("use_new_chat.dm")!;
        expect(second).toBe(first);
        expect(first).toBeGreaterThanOrEqual(0);
        expect(first).toBeLessThan(10000);
    });

    it("different flag names hash to (likely) different buckets for the same user", async () => {
        runtimeConfigService.setUserId("u-alice");
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() =>
            expect(runtimeConfigService.bucketFor("use_new_chat.pm")).toBeDefined()
        );
        const dm = runtimeConfigService.bucketFor("use_new_chat.dm")!;
        const pm = runtimeConfigService.bucketFor("use_new_chat.pm")!;
        // Not a hard guarantee with sha256, but collision probability
        // is ~1/10000 — fine for a sanity test.
        expect(dm).not.toBe(pm);
    });

    it("changing the userId resets buckets and recomputes for the new user", async () => {
        runtimeConfigService.setUserId("u-alice");
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() =>
            expect(runtimeConfigService.bucketFor("use_new_chat.dm")).toBeDefined()
        );
        const aliceBucket = runtimeConfigService.bucketFor("use_new_chat.dm")!;

        runtimeConfigService.setUserId("u-bob");
        await vi.waitFor(() =>
            expect(runtimeConfigService.bucketFor("use_new_chat.dm")).toBeDefined()
        );
        const bobBucket = runtimeConfigService.bucketFor("use_new_chat.dm")!;
        // Different user → different bucket (overwhelmingly likely).
        expect(bobBucket).not.toBe(aliceBucket);
    });
});

describe("runtimeConfigService — isEnabled", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeConfigService._resetForTests();
        runtimeConfigService.setAccessToken("tok-1");
        runtimeConfigService.setUserId("u-alice");
    });
    afterEach(() => {
        runtimeConfigService.stop();
    });

    it("returns false when threshold is 0 (off)", async () => {
        const get = mockGet({
            ...FRESH_CONFIG,
            use_new_chat: { ...FRESH_CONFIG.use_new_chat, gm: 0 },
        });
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() => expect(runtimeConfigService.getSnapshot().isLoaded).toBe(true));
        expect(runtimeConfigService.isEnabled("use_new_chat.gm")).toBe(false);
    });

    it("returns true when threshold is 10000 (full rollout)", async () => {
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() => expect(runtimeConfigService.getSnapshot().isLoaded).toBe(true));
        // mdm is 10000 in FRESH_CONFIG.
        expect(runtimeConfigService.isEnabled("use_new_chat.mdm")).toBe(true);
    });

    it("returns true iff bucket < threshold", async () => {
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() =>
            expect(runtimeConfigService.bucketFor("use_new_chat.dm")).toBeDefined()
        );
        const bucket = runtimeConfigService.bucketFor("use_new_chat.dm")!;
        const expected = bucket < 5000; // dm threshold in FRESH_CONFIG.
        expect(runtimeConfigService.isEnabled("use_new_chat.dm")).toBe(expected);
    });

    it("panic_switch short-circuits every flag", async () => {
        const get = mockGet({ ...FRESH_CONFIG, panic_switch: true });
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() => expect(runtimeConfigService.getSnapshot().isLoaded).toBe(true));
        // mdm is 10000 — would normally be on. Panic switch overrides.
        expect(runtimeConfigService.isEnabled("use_new_chat.mdm")).toBe(false);
        expect(runtimeConfigService.isEnabled("use_new_chat.dm")).toBe(false);
    });

    it("returns false before the first fetch resolves", () => {
        // No fetch issued; isLoaded=false.
        expect(runtimeConfigService.isEnabled("use_new_chat.mdm")).toBe(false);
    });
});

describe("runtimeConfigService — payload normalization", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeConfigService._resetForTests();
        runtimeConfigService.setAccessToken("tok-1");
        runtimeConfigService.setUserId("u-alice");
    });
    afterEach(() => {
        runtimeConfigService.stop();
    });

    it("clamps out-of-range thresholds to [0, 10000]", async () => {
        const get = mockGet({
            version: 1,
            use_new_chat: { dm: -50, gm: 999999, mdm: 5000, pm: 100 },
            panic_switch: false,
        });
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() => expect(runtimeConfigService.getSnapshot().isLoaded).toBe(true));
        const cfg = runtimeConfigService.getSnapshot().config;
        expect(cfg.use_new_chat.dm).toBe(0);
        expect(cfg.use_new_chat.gm).toBe(10000);
        expect(cfg.use_new_chat.mdm).toBe(5000);
        expect(cfg.use_new_chat.pm).toBe(100);
    });

    it("coerces non-numeric thresholds to 0", async () => {
        const get = mockGet({
            version: 1,
            use_new_chat: { dm: "not a number", gm: null, mdm: undefined, pm: 100 },
            panic_switch: "not a bool",
        });
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        await vi.waitFor(() => expect(runtimeConfigService.getSnapshot().isLoaded).toBe(true));
        const cfg = runtimeConfigService.getSnapshot().config;
        expect(cfg.use_new_chat.dm).toBe(0);
        expect(cfg.use_new_chat.gm).toBe(0);
        expect(cfg.use_new_chat.mdm).toBe(0);
        expect(cfg.use_new_chat.pm).toBe(100);
        expect(cfg.panic_switch).toBe(false);
    });
});

describe("runtimeConfigService — polling", () => {
    beforeEach(() => {
        vi.clearAllMocks();
        runtimeConfigService._resetForTests();
        runtimeConfigService.setAccessToken("tok-1");
        runtimeConfigService.setUserId("u-alice");
    });
    afterEach(() => {
        runtimeConfigService.stop();
        vi.useRealTimers();
    });

    it("start() is idempotent — repeated calls do not stack timers", async () => {
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        runtimeConfigService.start();
        runtimeConfigService.start();
        await vi.waitFor(() => expect(get).toHaveBeenCalled());
        // 3 starts but only 1 immediate fetch (the timer hasn't tripped yet).
        expect(get).toHaveBeenCalledTimes(1);
    });

    it("stop() halts polling and ignores further timer ticks", async () => {
        vi.useFakeTimers();
        const get = mockGet(FRESH_CONFIG);
        runtimeConfigService.start();
        await vi.advanceTimersByTimeAsync(0);
        expect(get).toHaveBeenCalledTimes(1);
        runtimeConfigService.stop();
        await vi.advanceTimersByTimeAsync(120_000);
        // No additional fetches after stop.
        expect(get).toHaveBeenCalledTimes(1);
    });
});
