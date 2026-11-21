import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { REFRESH_LOCK_NAME, refreshSession } from "../services/refreshSession";

type LockFn = (name: string, options: unknown, cb: () => Promise<unknown>) => Promise<unknown>;

// A minimal Web Locks stand-in: one exclusive queue per name.
const installFakeLocks = () => {
    const queues = new Map<string, Promise<unknown>>();
    const names: string[] = [];
    const request: LockFn = (name, _options, cb) => {
        names.push(name);
        const prev = queues.get(name) ?? Promise.resolve();
        const run = prev.then(cb, cb);
        queues.set(
            name,
            run.catch(() => undefined)
        );
        return run;
    };
    Object.defineProperty(navigator, "locks", { value: { request }, configurable: true });
    return names;
};

const json = (status: number, body: unknown = {}) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { "Content-Type": "application/json" },
    });

describe("refreshSession (MIP-1878, MIP-1882)", () => {
    beforeEach(() => {
        vi.useFakeTimers();
        vi.spyOn(Math, "random").mockReturnValue(0);
    });
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
        Reflect.deleteProperty(navigator, "locks");
    });

    it("refreshes with POST and the cookie", async () => {
        const fetchMock = vi.fn().mockResolvedValue(json(200, { access: "A1" }));
        vi.stubGlobal("fetch", fetchMock);
        await expect(refreshSession()).resolves.toEqual({ kind: "ok", access: "A1" });
        const [url, init] = fetchMock.mock.calls[0];
        expect(String(url)).toContain("/user/signin/refresh/");
        expect(init.method).toBe("POST");
        expect(init.credentials).toBe("include");
    });

    it("takes the cross-tab lock and still works without Web Locks", async () => {
        const names = installFakeLocks();
        vi.stubGlobal(
            "fetch",
            vi.fn(async () => json(200, { access: "A" }))
        );
        await refreshSession();
        expect(names).toEqual([REFRESH_LOCK_NAME]);

        Reflect.deleteProperty(navigator, "locks");
        await expect(refreshSession()).resolves.toEqual({ kind: "ok", access: "A" });
    });

    it("runs two tabs' refreshes one after the other, never at once", async () => {
        installFakeLocks();
        let inFlight = 0;
        let maxInFlight = 0;
        const fetchMock = vi.fn(async () => {
            inFlight += 1;
            maxInFlight = Math.max(maxInFlight, inFlight);
            await new Promise((r) => setTimeout(r, 50));
            inFlight -= 1;
            return json(200, { access: "A" });
        });
        vi.stubGlobal("fetch", fetchMock);
        // Two tabs share the lock but not the in-tab promise: simulate with module isolation.
        vi.resetModules();
        const other = await import("../services/refreshSession");
        const a = refreshSession();
        const b = other.refreshSession();
        await vi.advanceTimersByTimeAsync(200);
        await Promise.all([a, b]);
        expect(fetchMock).toHaveBeenCalledTimes(2);
        expect(maxInFlight).toBe(1);
    });

    it("shares one request between callers in the same tab", async () => {
        const fetchMock = vi.fn().mockResolvedValue(json(200, { access: "A" }));
        vi.stubGlobal("fetch", fetchMock);
        await Promise.all([refreshSession(), refreshSession()]);
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it("retries once after 401/403 and succeeds when another tab rotated", async () => {
        const fetchMock = vi
            .fn()
            .mockResolvedValueOnce(json(403, { error: "Invalid or expired refresh token" }))
            .mockResolvedValueOnce(json(200, { access: "A2" }));
        vi.stubGlobal("fetch", fetchMock);
        const p = refreshSession();
        await vi.advanceTimersByTimeAsync(2_100);
        await expect(p).resolves.toEqual({ kind: "ok", access: "A2" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("reports unauthenticated only after exactly two refused attempts", async () => {
        const fetchMock = vi.fn(async () => json(401));
        vi.stubGlobal("fetch", fetchMock);
        const p = refreshSession();
        await vi.advanceTimersByTimeAsync(2_100);
        await expect(p).resolves.toEqual({ kind: "unauthenticated" });
        expect(fetchMock).toHaveBeenCalledTimes(2);
    });

    it("does not retry a server error or a network failure (the backoff owns those)", async () => {
        const fetchMock = vi.fn().mockResolvedValueOnce(json(500));
        vi.stubGlobal("fetch", fetchMock);
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(refreshSession()).resolves.toEqual({ kind: "transient" });
        expect(fetchMock).toHaveBeenCalledTimes(1);

        const failing = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));
        vi.stubGlobal("fetch", failing);
        await expect(refreshSession()).resolves.toEqual({ kind: "transient" });
        expect(failing).toHaveBeenCalledTimes(1);
    });

    it("treats a 200 without an access token as transient", async () => {
        vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(200, {})));
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await expect(refreshSession()).resolves.toEqual({ kind: "transient" });
    });
});
