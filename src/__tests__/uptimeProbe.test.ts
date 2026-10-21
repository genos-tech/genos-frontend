// @vitest-environment node
// The uptime probe (scripts/uptime-probe.mjs, run by .github/workflows/uptime.yml).
// What's pinned: one incident fails one run (GitHub's failed-run email
// is the alert), the certificate threshold catches a stuck renewal and
// not a normal one, and a public log never carries the token.
import { EventEmitter } from "node:events";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import tls from "node:tls";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
    ALERTING_URL,
    certWarnDays,
    describeError,
    diffIncidents,
    judgeAlerting,
    judgeCert,
    judgeDomain,
    main,
    RDAP_URL,
    TARGETS,
} from "../../scripts/uptime-probe.mjs";

const DAY = 24 * 60 * 60 * 1000;
const NOW = new Date("2026-10-21T00:00:00Z");
const days = (n: number) => new Date(NOW.getTime() + n * DAY);

describe("certificate threshold", () => {
    it("is 21 days for a 90-day Let's Encrypt cert", () => {
        expect(certWarnDays(days(-60), days(30))).toBe(21);
    });

    it("is a quarter of a short-lived cert's lifetime", () => {
        // Let's Encrypt's 6-day certs renew with ~2 days left.
        expect(certWarnDays(days(-4), days(2))).toBe(1.5);
    });

    it("passes a cert Railway hasn't renewed yet but will", () => {
        // Renewal happens at about 30 days left.
        expect(judgeCert("api", days(-62), days(28), NOW)).toBeNull();
    });

    it("fails a cert whose renewal is overdue", () => {
        expect(judgeCert("api", days(-70), days(20), NOW)).toMatch(/expires in 20 days/);
    });

    it("fails an expired cert", () => {
        expect(judgeCert("api", days(-91), days(-1), NOW)).toMatch(/expired on 2026-10-20/);
    });
});

describe("domain", () => {
    const rdap = (date: string) => ({
        events: [
            { eventAction: "registration", eventDate: "2025-05-20T00:00:00Z" },
            { eventAction: "expiration", eventDate: date },
        ],
    });

    it("passes a registration with time left", () => {
        expect(judgeDomain(rdap("2027-05-20T00:00:00Z"), NOW)).toBeNull();
    });

    it("fails 30 days out", () => {
        expect(judgeDomain(rdap("2026-11-19T00:00:00Z"), NOW)).toMatch(/expires in 29 days/);
    });

    it("fails an answer with no expiry rather than passing it", () => {
        expect(judgeDomain({ events: [] }, NOW)).toMatch(/no expiration/);
    });
});

describe("alert pipeline", () => {
    it("passes 200", () => {
        expect(judgeAlerting(200, { status: "ok" })).toBeNull();
    });

    it("names a token mismatch on 404", () => {
        expect(judgeAlerting(404, null)).toMatch(/OPS_HEALTH_TOKEN differs/);
    });

    it("says why on 503", () => {
        expect(judgeAlerting(503, { tick_age_seconds: 1500, unsent_alerts: 0 })).toMatch(
            /25 min ago/
        );
        expect(judgeAlerting(503, { tick_age_seconds: null, unsent_alerts: 0 })).toMatch(
            /never succeeded/
        );
        expect(judgeAlerting(503, { tick_age_seconds: 60, unsent_alerts: 2 })).toMatch(
            /2 alert\(s\) unsent/
        );
    });
});

describe("incidents", () => {
    it("opens what's new, keeps what continues, resolves what cleared", () => {
        const { opened, ongoing, resolved, state } = diffIncidents(
            { "up:api": "api down", "cert:collab": "collab cert" },
            [
                { key: "up:api", message: "api down again" },
                { key: "domain", message: "domain soon" },
            ]
        );
        expect(opened.map((f) => f.key)).toEqual(["domain"]);
        expect(ongoing.map((f) => f.key)).toEqual(["up:api"]);
        expect(resolved.map((f) => f.key)).toEqual(["cert:collab"]);
        expect(state).toEqual({ "up:api": "api down again", domain: "domain soon" });
    });
});

describe("describeError", () => {
    it("keeps the class and code, not the message", () => {
        const error = new TypeError("fetch failed: https://x?token=secret");
        Object.assign(error, { cause: { code: "ECONNREFUSED" } });
        expect(describeError(error)).toBe("TypeError ECONNREFUSED");
    });
});

// ── a whole run ─────────────────────────────────────────────────────────

const TOKEN = "probe-token-never-logged";

function fakeTls(validTo: Date) {
    return vi.spyOn(tls, "connect").mockImplementation(((
        _options: unknown,
        onConnect: () => void
    ) => {
        const socket = Object.assign(new EventEmitter(), {
            getPeerCertificate: () => ({
                valid_from: days(-60).toUTCString(),
                valid_to: validTo.toUTCString(),
            }),
            end: () => undefined,
            setTimeout: () => undefined,
            destroy: () => undefined,
        });
        queueMicrotask(onConnect);
        return socket;
    }) as unknown as typeof tls.connect);
}

function fakeFetch(down: Set<string>) {
    const calls: { url: string; init?: RequestInit }[] = [];
    vi.stubGlobal(
        "fetch",
        vi.fn(async (url: string, init?: RequestInit) => {
            calls.push({ url, init });
            if (down.has(url)) return new Response("gateway body", { status: 502 });
            if (url === RDAP_URL) {
                return Response.json({
                    events: [{ eventAction: "expiration", eventDate: "2027-05-20T00:00:00Z" }],
                });
            }
            if (url === ALERTING_URL) {
                return Response.json({ status: "ok", tick_age_seconds: 60, unsent_alerts: 0 });
            }
            return new Response("OK", { status: 200 });
        })
    );
    return calls;
}

describe("a run", () => {
    let dir: string;
    let logs: string[];

    beforeEach(() => {
        vi.useFakeTimers({ toFake: ["setTimeout"], now: NOW });
        dir = fs.mkdtempSync(path.join(os.tmpdir(), "uptime-"));
        vi.stubEnv("STATE_FILE", path.join(dir, "state.json"));
        vi.stubEnv("GITHUB_STEP_SUMMARY", path.join(dir, "summary.md"));
        vi.stubEnv("OPS_HEALTH_TOKEN", TOKEN);
        logs = [];
        vi.spyOn(console, "log").mockImplementation((line: string) => {
            logs.push(line);
        });
        process.exitCode = undefined;
    });

    afterEach(() => {
        process.exitCode = undefined;
        vi.useRealTimers();
        vi.unstubAllEnvs();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        fs.rmSync(dir, { recursive: true, force: true });
    });

    async function run() {
        const done = main();
        // The retry waits 20 s on a 5xx; let it.
        await vi.runAllTimersAsync();
        await done;
        return process.exitCode;
    }

    it("passes when everything answers, and sends the token only to the API", async () => {
        fakeTls(days(60));
        const calls = fakeFetch(new Set());
        expect(await run()).toBeUndefined();
        const withAuth = calls.filter(
            (c) => (c.init?.headers as Record<string, string> | undefined)?.Authorization
        );
        expect(withAuth.map((c) => c.url)).toEqual([ALERTING_URL]);
        expect(calls.map((c) => c.url)).toEqual(
            expect.arrayContaining([...TARGETS.map((t) => t.url), RDAP_URL, ALERTING_URL])
        );
    });

    it("fails the run that opens an incident, and only that run", async () => {
        fakeTls(days(60));
        const api = TARGETS.find((t) => t.name === "api")!.url;
        fakeFetch(new Set([api]));

        expect(await run()).toBe(1);
        process.exitCode = undefined;
        expect(await run()).toBeUndefined();
        expect(logs.some((l) => l.includes("Still failing: api"))).toBe(true);

        fakeFetch(new Set());
        expect(await run()).toBeUndefined();
        expect(logs.some((l) => l.startsWith("Resolved: api"))).toBe(true);
    });

    it("asks the workflow to save the state exactly when it changed", async () => {
        // Unsaved, an opened incident would be opened (and mailed) again.
        const output = path.join(dir, "output");
        vi.stubEnv("GITHUB_OUTPUT", output);
        const last = () => fs.readFileSync(output, "utf8").trim().split("\n").at(-1);
        fakeTls(days(60));
        const collab = TARGETS.find((t) => t.name === "collab")!.url;

        fakeFetch(new Set([collab]));
        await run();
        expect(last()).toBe("changed=true");
        await run();
        expect(last()).toBe("changed=false");
        fakeFetch(new Set());
        await run();
        expect(last()).toBe("changed=true");
        await run();
        expect(last()).toBe("changed=false");
    });

    it("never logs the token or a response body", async () => {
        fakeTls(days(60));
        fakeFetch(new Set(TARGETS.map((t) => t.url)));
        await run();
        const written = logs.join("\n") + fs.readFileSync(path.join(dir, "summary.md"), "utf8");
        expect(written).not.toContain(TOKEN);
        expect(written).not.toContain("gateway body");
    });

    it("doesn't fail on an unset token, but says so", async () => {
        vi.stubEnv("OPS_HEALTH_TOKEN", "");
        fakeTls(days(60));
        const calls = fakeFetch(new Set());
        expect(await run()).toBeUndefined();
        expect(calls.map((c) => c.url)).not.toContain(ALERTING_URL);
        expect(logs.some((l) => l.includes("OPS_HEALTH_TOKEN is not set"))).toBe(true);
    });
});
