/**
 * Request-error toast bus + the api.ts response interceptor that feeds it.
 *
 * `Date.now` is spied so the bus's 4s dedup window is deterministic: each
 * test advances the clock past the window (beforeEach) so emissions never
 * bleed across tests, and the dedup test drives the clock by hand.
 */
import type { InternalAxiosRequestConfig } from "axios";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    authApi,
    registerApiHealthListener,
    unregisterApiHealthListener,
} from "../../services/api";
import {
    emitRequestError,
    notifyActionError,
    subscribeRequestErrors,
    type RequestErrorKind,
} from "../../services/requestErrorNotifier";

let now = 0;
beforeEach(() => {
    now += 10_000;
    vi.spyOn(Date, "now").mockImplementation(() => now);
});
afterEach(() => {
    vi.restoreAllMocks();
});

const capture = () => {
    const seen: RequestErrorKind[] = [];
    const unsub = subscribeRequestErrors((k) => seen.push(k));
    return { seen, unsub };
};

describe("requestErrorNotifier bus", () => {
    it("delivers an emitted kind to subscribers", () => {
        const { seen, unsub } = capture();
        emitRequestError("serverError");
        expect(seen).toEqual(["serverError"]);
        unsub();
    });

    it("stops delivering after unsubscribe", () => {
        const { seen, unsub } = capture();
        unsub();
        emitRequestError("requestFailed");
        expect(seen).toEqual([]);
    });

    it("de-dups identical kinds within the window but allows distinct kinds", () => {
        const { seen, unsub } = capture();
        emitRequestError("serverError");
        emitRequestError("serverError"); // same kind, same instant -> collapsed
        emitRequestError("permissionDenied"); // distinct kind -> delivered
        expect(seen).toEqual(["serverError", "permissionDenied"]);
        // Once the window elapses, the same kind fires again.
        now += 5_000;
        emitRequestError("serverError");
        expect(seen).toEqual(["serverError", "permissionDenied", "serverError"]);
        unsub();
    });
});

describe("notifyActionError", () => {
    it("skips DISCONNECTED — the persistent WS-lost banner already covers it", () => {
        const { seen, unsub } = capture();
        notifyActionError({ code: "DISCONNECTED" });
        expect(seen).toEqual([]);
        unsub();
    });

    it("emits actionFailed for a server rejection / timeout / unknown error", () => {
        const { seen, unsub } = capture();
        notifyActionError({ code: "TIMEOUT" });
        expect(seen).toEqual(["actionFailed"]);
        unsub();
    });
});

describe("api.ts response interceptor → request-error toast", () => {
    // An axios instance whose adapter always rejects with a synthetic HTTP
    // error carrying `response.status`, so the real wired interceptor runs.
    const rejectingWith = (status: number) => {
        const instance = authApi("tok");
        instance.defaults.adapter = async (config: InternalAxiosRequestConfig) => {
            throw Object.assign(new Error(`HTTP ${status}`), {
                isAxiosError: true,
                config,
                response: { status, data: {}, statusText: "", headers: {}, config },
            });
        };
        return instance;
    };

    it("toasts serverError on 5xx", async () => {
        const { seen, unsub } = capture();
        await expect(rejectingWith(500).get("/x")).rejects.toBeDefined();
        expect(seen).toEqual(["serverError"]);
        unsub();
    });

    it("toasts permissionDenied on 403", async () => {
        const { seen, unsub } = capture();
        await expect(rejectingWith(403).get("/x")).rejects.toBeDefined();
        expect(seen).toEqual(["permissionDenied"]);
        unsub();
    });

    it("toasts requestFailed on other 4xx", async () => {
        const { seen, unsub } = capture();
        await expect(rejectingWith(404).get("/x")).rejects.toBeDefined();
        expect(seen).toEqual(["requestFailed"]);
        unsub();
    });

    it("stays silent on 401 — the auth-refresh path owns it", async () => {
        const { seen, unsub } = capture();
        await expect(rejectingWith(401).get("/x")).rejects.toBeDefined();
        expect(seen).toEqual([]);
        unsub();
    });

    it("stays silent when the caller passes suppressErrorToast", async () => {
        const { seen, unsub } = capture();
        await expect(
            rejectingWith(500).get("/x", { suppressErrorToast: true })
        ).rejects.toBeDefined();
        expect(seen).toEqual([]);
        unsub();
    });

    it("stays silent on a proxied GitHub 502, which isn't Genos being down", async () => {
        // The `/github/*` endpoints call GitHub on the user's behalf, so a
        // refusal upstream — a token whose scopes don't cover the repo —
        // comes back as a 502. Blaming the Genos server for that both
        // misattributes it and advises a retry that can never work, so
        // those callers opt out (see `noSharedToast` in github.ts).
        const { seen, unsub } = capture();
        await expect(
            rejectingWith(502).get("/github/pulls/acme/rocket/7/", { suppressErrorToast: true })
        ).rejects.toBeDefined();
        expect(seen).toEqual([]);
        unsub();
    });

    it("stays silent on a network error (no response → the API-down banner owns it)", async () => {
        const { seen, unsub } = capture();
        const instance = authApi("tok");
        instance.defaults.adapter = async () => {
            throw Object.assign(new Error("Network Error"), { isAxiosError: true });
        };
        await expect(instance.get("/x")).rejects.toBeDefined();
        expect(seen).toEqual([]);
        unsub();
    });
});

describe("api.ts → API-down reason", () => {
    // A rejection with no `response`, which is the only shape that
    // reaches the health listener.
    const failingWith = (extra: Record<string, unknown>) => {
        const instance = authApi("tok");
        instance.defaults.adapter = async () => {
            throw Object.assign(new Error("Network Error"), { isAxiosError: true, ...extra });
        };
        return instance;
    };

    const reasonFor = async (extra: Record<string, unknown>) => {
        const calls: Array<[boolean, string | undefined]> = [];
        registerApiHealthListener((isDown, reason) => calls.push([isDown, reason]));
        await expect(failingWith(extra).get("/x")).rejects.toBeDefined();
        unregisterApiHealthListener();
        return calls;
    };

    afterEach(() => {
        unregisterApiHealthListener();
    });

    it("blames the network when the browser says the device is offline", async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(false);
        // Offline wins even over a timeout code: there is no point telling
        // someone to wait for a server they currently cannot reach at all.
        expect(await reasonFor({ code: "ECONNABORTED" })).toEqual([[true, "offline"]]);
    });

    it("reports a timeout for axios's own abort and the platform's", async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
        expect(await reasonFor({ code: "ECONNABORTED" })).toEqual([[true, "timeout"]]);
        expect(await reasonFor({ code: "ETIMEDOUT" })).toEqual([[true, "timeout"]]);
    });

    it("falls back to plain unreachable for a refused / unclassifiable failure", async () => {
        vi.spyOn(navigator, "onLine", "get").mockReturnValue(true);
        expect(await reasonFor({ code: "ERR_NETWORK" })).toEqual([[true, "unreachable"]]);
        expect(await reasonFor({})).toEqual([[true, "unreachable"]]);
    });

    it("reports recovery with no reason attached", async () => {
        const calls: Array<[boolean, string | undefined]> = [];
        registerApiHealthListener((isDown, reason) => calls.push([isDown, reason]));
        const instance = authApi("tok");
        instance.defaults.adapter = async (config: InternalAxiosRequestConfig) => ({
            data: {},
            status: 200,
            statusText: "OK",
            headers: {},
            config,
        });
        await instance.get("/x");
        unregisterApiHealthListener();
        expect(calls).toEqual([[false, undefined]]);
    });
});
