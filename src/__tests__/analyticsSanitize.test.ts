/**
 * What posthog-js is allowed to send (MIP-1741).
 *
 * The privacy page promises "the path of the pages you view (without query
 * strings)". The library adds the full URL, the referrer, campaign parameters,
 * the browser language and the timezone by itself, so the rule is enforced at
 * the one place every event passes: `before_send`. These tests assert it on the
 * event as the library builds it, and at the real `posthog.init` call.
 */

import type { CaptureResult } from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { analytics } from "../services/analytics";
import { sanitizeCaptureResult } from "../services/analyticsSanitize";

const posthogMock = vi.hoisted(() => ({
    init: vi.fn(),
    identify: vi.fn(),
    capture: vi.fn(),
    reset: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: posthogMock }));

const event = (over: Partial<CaptureResult> = {}): CaptureResult =>
    ({
        uuid: "u-1",
        event: "$pageview",
        properties: {},
        ...over,
    }) as CaptureResult;

const clean = (over: Partial<CaptureResult>): CaptureResult => {
    const out = sanitizeCaptureResult(event(over));
    if (!out) throw new Error("the event was dropped");
    return out;
};

describe("sanitizeCaptureResult", () => {
    it("removes the query string and hash from every page address", () => {
        const out = clean({
            properties: {
                $current_url: "https://genosai.dev/plans?utm_source=x&token=secret#section",
                $session_entry_url: "https://genosai.dev/home?ref=abc",
                $initial_current_url: "https://genosai.dev/?a=1",
                path: "/plans",
            },
        });
        expect(out.properties).toMatchObject({
            $current_url: "https://genosai.dev/plans",
            $session_entry_url: "https://genosai.dev/home",
            $initial_current_url: "https://genosai.dev/",
            path: "/plans",
        });
    });

    it("cuts a referrer to its origin and keeps $direct", () => {
        const out = clean({
            properties: {
                $referrer: "https://genosai.dev/home?utm_campaign=launch&x=1",
                $initial_referrer: "https://news.example.com/a/b?id=9#c",
                $referring_domain: "genosai.dev",
            },
        });
        expect(out.properties).toMatchObject({
            $referrer: "https://genosai.dev",
            $initial_referrer: "https://news.example.com",
            $referring_domain: "genosai.dev",
        });
        expect(clean({ properties: { $referrer: "$direct" } }).properties.$referrer).toBe(
            "$direct"
        );
    });

    it("drops campaign parameters, the browser language and the timezone", () => {
        const out = clean({
            properties: {
                utm_source: "x",
                utm_campaign: "launch",
                gclid: "g",
                fbclid: "f",
                $initial_utm_source: "x",
                $initial_gclid: "g",
                $browser_language: "ja-JP",
                $browser_language_prefix: "ja",
                $timezone: "Asia/Tokyo",
                $timezone_offset: -540,
                $pathname: "/plans",
            },
        });
        expect(Object.keys(out.properties).sort()).toEqual(["$pathname"]);
    });

    it("cleans the person properties the same way", () => {
        const out = clean({
            $set: { $current_url: "https://genosai.dev/a?b=1", $timezone: "Asia/Tokyo" },
            $set_once: {
                $initial_current_url: "https://genosai.dev/?utm_source=x",
                $initial_referrer: "https://x.example/p?q=1",
                $initial_utm_source: "x",
                role: "admin",
            },
        });
        expect(out.$set).toEqual({ $current_url: "https://genosai.dev/a" });
        expect(out.$set_once).toEqual({
            $initial_current_url: "https://genosai.dev/",
            $initial_referrer: "https://x.example",
            role: "admin",
        });
    });

    it("leaves everything else alone and never drops or mutates an event", () => {
        const original = event({
            properties: {
                distinct_id: "user-1",
                teamId: "team-1",
                $current_url: "https://genosai.dev/a?b=1",
            },
        });
        const copy = JSON.parse(JSON.stringify(original));

        const out = sanitizeCaptureResult(original);

        expect(out).not.toBeNull();
        expect(out).toMatchObject({ uuid: "u-1", event: "$pageview" });
        expect(out?.properties).toMatchObject({ distinct_id: "user-1", teamId: "team-1" });
        expect(original).toEqual(copy);
    });

    it("passes a missing event through and survives an odd shape", () => {
        expect(sanitizeCaptureResult(null)).toBeNull();
        const odd = event({ properties: { $current_url: 42 as unknown as string } });
        expect(() => sanitizeCaptureResult(odd)).not.toThrow();
    });
});

describe("analytics.init", () => {
    beforeEach(() => {
        vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
        vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
        window.localStorage.clear();
    });

    it("installs the sanitizer as before_send on the real client", async () => {
        analytics.init();
        await analytics.whenReady();

        const options = posthogMock.init.mock.calls[0][1];
        expect(options.before_send).toBe(sanitizeCaptureResult);
    });
});
