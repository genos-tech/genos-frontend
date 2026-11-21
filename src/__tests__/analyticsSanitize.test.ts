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
import {
    sanitizeCaptureResult,
    sanitizeMarketingCaptureResult,
} from "../services/analyticsSanitize";

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
        // posthog-js can hand a null when an earlier `before_send` dropped the event.
        expect(sanitizeCaptureResult(null as unknown as CaptureResult)).toBeNull();
        const odd = event({ properties: { $current_url: 42 as unknown as string } });
        expect(() => sanitizeCaptureResult(odd)).not.toThrow();
    });
});

describe("campaign values (MIP-1778)", () => {
    it("lets only the five utm_* values of the carrier through, and drops the library's own", () => {
        const out = clean({
            properties: {
                utm_source: "library",
                utm_term: "library",
                $initial_utm_source: "library",
                gclid: "g",
                genos_utm: {
                    utm_source: "newsletter",
                    utm_medium: "email",
                    utm_campaign: "launch 2026",
                    utm_content: "a.b-c_d~e+f",
                    utm_term: "ai",
                    utm_id: "9",
                    gclid: "g",
                },
            },
        });
        expect(out.properties).toEqual({
            utm_source: "newsletter",
            utm_medium: "email",
            utm_campaign: "launch 2026",
            utm_content: "a.b-c_d~e+f",
            utm_term: "ai",
        });
    });

    it("drops the session-entry copies of campaign values too (seen in a real browser)", () => {
        const out = clean({
            properties: {
                $session_entry_utm_source: "<raw from the url>",
                $session_entry_utm_campaign: "launch",
                $session_entry_gclid: "g",
                $session_entry_pathname: "/home",
            },
        });
        expect(out.properties).toEqual({ $session_entry_pathname: "/home" });
    });

    it("checks each value: at most 100 characters, plain characters only, strings only", () => {
        const out = clean({
            properties: {
                genos_utm: {
                    utm_source: "a".repeat(100),
                    utm_medium: "a".repeat(101),
                    utm_campaign: "<script>alert(1)</script>",
                    utm_content: "https://x.example/?a=1",
                    utm_term: 42,
                },
            },
        });
        expect(out.properties).toEqual({ utm_source: "a".repeat(100) });
    });

    it("never sends the carrier itself, and ignores a carrier that is not an object", () => {
        expect(clean({ properties: { genos_utm: "x" } }).properties).toEqual({});
        expect(clean({ properties: { genos_utm: null } }).properties).toEqual({});
        // Only `properties` is unpacked: a carrier in the person properties is just dropped.
        const out = clean({ $set: { genos_utm: { utm_source: "x" } } });
        expect(out.$set).toEqual({});
    });
});

describe("sanitizeMarketingCaptureResult (marketing start after Accept)", () => {
    it("is the same sanitizer, minus the device fields the privacy row does not list", () => {
        const input = event({
            properties: {
                $current_url: "https://genosai.dev/plans?x=1",
                $raw_user_agent: "UA",
                $browser: "Chrome",
                $os: "Mac OS X",
                $device_type: "Desktop",
                $screen_width: 1440,
                $viewport_height: 800,
                title: "A page",
                distinct_id: "d",
                $device_id: "d",
                token: "t",
                path: "/plans",
            },
        });
        const out = sanitizeMarketingCaptureResult(input);
        expect(out?.properties).toEqual({
            $current_url: "https://genosai.dev/plans",
            distinct_id: "d",
            $device_id: "d",
            token: "t",
            path: "/plans",
        });
        // The app's sanitizer keeps them (the app start is unchanged).
        expect(sanitizeCaptureResult(input)?.properties).toHaveProperty("$browser");
    });

    it("passes a missing event through", () => {
        expect(sanitizeMarketingCaptureResult(null as unknown as CaptureResult)).toBeNull();
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
