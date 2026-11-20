/**
 * What actually reaches posthog-js after "Accept" (MIP-1778): the real `analytics` wrapper, the
 * real sanitizer and the real funnel helpers, with posthog-js replaced by a recorder that runs
 * every event through the `before_send` the wrapper installed, on an event shaped the way the
 * library shapes it (full URL with query string, referrer, campaign values, language).
 */
import type { CaptureResult } from "posthog-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const posthog = vi.hoisted(() => ({
    init: vi.fn(),
    capture: vi.fn(),
    identify: vi.fn(),
    reset: vi.fn(),
    unregister: vi.fn(),
    opt_in_capturing: vi.fn(),
    opt_out_capturing: vi.fn(),
}));
vi.mock("posthog-js", () => ({ default: posthog }));

type Modules = {
    analytics: typeof import("../services/analytics").analytics;
    funnel: typeof import("../services/marketingFunnel");
    consent: typeof import("../services/marketingConsent");
};

// The wrapper keeps module state (started, queue), so each test gets a fresh copy of it. No
// component is rendered here, so a second copy of React is harmless.
const load = async (search = ""): Promise<Modules> => {
    vi.resetModules();
    window.history.replaceState({}, "", `/plans${search}`);
    return {
        analytics: (await import("../services/analytics")).analytics,
        funnel: await import("../services/marketingFunnel"),
        consent: await import("../services/marketingConsent"),
    };
};

/** An event as posthog-js builds it on `/plans?utm_source=...&token=...`, plus what we passed. */
const throughBeforeSend = (name: string, passed: Record<string, unknown>): CaptureResult => {
    const options = posthog.init.mock.calls[0][1];
    const out = options.before_send({
        uuid: "u",
        event: name,
        properties: {
            ...passed,
            $current_url: "https://genosai.dev/plans?utm_source=library&token=SECRET",
            $referrer: "https://news.example.com/post?id=42",
            utm_source: "library-copy",
            utm_medium: "from-the-library",
            $initial_utm_source: "library-initial",
            gclid: "click-id",
            $browser_language: "ja-JP",
            $timezone: "Asia/Tokyo",
            token: "phc_x",
            distinct_id: "anon-id",
        },
    });
    return out as CaptureResult;
};

const lastEvent = (): [string, Record<string, unknown>, Record<string, unknown> | undefined] =>
    posthog.capture.mock.calls.at(-1) as never;

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
});

describe("before Accept", () => {
    it("loads nothing, stores nothing and sends nothing, whatever the page asks for", async () => {
        const { analytics, funnel, consent } = await load("?utm_source=newsletter");
        expect(consent.consentNeeded()).toBe(true);
        expect(consent.marketingAnalyticsAllowed()).toBe(false);

        funnel.trackMarketingPageview("/plans", "en");
        funnel.trackCtaClicked("hero_try_demo", "/plans", "en");
        funnel.trackSignupCompleted("email");
        await analytics.whenReady();

        expect(posthog.init).not.toHaveBeenCalled();
        expect(posthog.capture).not.toHaveBeenCalled();
        expect(sessionStorage.length).toBe(0);
        expect(localStorage.length).toBe(0);
    });
});

describe("after Accept", () => {
    it("starts the library once, with the sanitizer, and with the extras switched off", async () => {
        const { analytics, consent } = await load();
        consent.chooseConsent("accepted");
        await analytics.whenReady();
        consent.chooseConsent("accepted"); // idempotent

        expect(posthog.init).toHaveBeenCalledTimes(1);
        const options = posthog.init.mock.calls[0][1];
        expect(options).toMatchObject({
            autocapture: false,
            capture_pageview: false,
            disable_session_recording: true,
            capture_heatmaps: false,
            capture_dead_clicks: false,
            capture_exceptions: false,
            capture_performance: false,
            advanced_disable_flags: true,
            save_referrer: false,
            save_campaign_params: false,
        });
        expect(typeof options.before_send).toBe("function");
        expect(JSON.parse(localStorage.getItem("genos-marketing-consent:v1") ?? "")).toEqual({
            choice: "accepted",
            v: 1,
        });
    });

    it("$pageview leaves with the path and the language only", async () => {
        const { analytics, funnel, consent } = await load();
        consent.chooseConsent("accepted");
        await analytics.whenReady();

        funnel.trackMarketingPageview("/plans", "en");
        const [name, props] = lastEvent();
        expect(name).toBe("$pageview");

        const sent = throughBeforeSend(name, props).properties;
        expect(sent).toMatchObject({
            path: "/plans",
            lang: "en",
            $current_url: "https://genosai.dev/plans",
            $referrer: "https://news.example.com",
        });
        // Nothing the library lifted from the page address, and no browser language / timezone.
        for (const key of [
            "utm_source",
            "utm_medium",
            "$initial_utm_source",
            "gclid",
            "$browser_language",
            "$timezone",
        ]) {
            expect(sent, key).not.toHaveProperty(key);
        }
        expect(JSON.stringify(sent)).not.toContain("SECRET");
        expect(sent).not.toHaveProperty("genos_utm");
    });

    it("deletes the stored landing address and referrer the library keeps for the session", async () => {
        const { analytics, funnel, consent } = await load();
        consent.chooseConsent("accepted");
        await analytics.whenReady();
        funnel.trackMarketingPageview("/plans", "en");
        expect(posthog.unregister).toHaveBeenCalledWith("$client_session_props");
    });

    it("cta_clicked leaves with cta, page and lang, by beacon", async () => {
        const { analytics, funnel, consent } = await load();
        consent.chooseConsent("accepted");
        await analytics.whenReady();

        funnel.trackCtaClicked("hero_try_demo", "/home", "ja");
        const [name, props, options] = lastEvent();
        expect(name).toBe("cta_clicked");
        expect(props).toEqual({ cta: "hero_try_demo", page: "/home", lang: "ja" });
        expect(options).toEqual({ transport: "sendBeacon", send_instantly: true });
        const sent = throughBeforeSend(name, props).properties;
        expect(sent).toMatchObject({ cta: "hero_try_demo", page: "/home", lang: "ja" });
    });

    it("ignores a button name that is not a stable data-cta name", async () => {
        const { analytics, funnel, consent } = await load();
        consent.chooseConsent("accepted");
        await analytics.whenReady();
        posthog.capture.mockClear();
        funnel.trackCtaClicked("Try The Demo!", "/home", "en");
        funnel.trackCtaClicked(null, "/home", "en");
        funnel.trackCtaClicked("x".repeat(80), "/home", "en");
        expect(posthog.capture).not.toHaveBeenCalled();
    });

    it("signup_completed leaves with the method only", async () => {
        const { analytics, funnel, consent } = await load();
        consent.chooseConsent("accepted");
        await analytics.whenReady();

        funnel.trackSignupCompleted("email");
        const [name, props] = lastEvent();
        expect(name).toBe("signup_completed");
        expect(props).toEqual({ method: "email" });
    });

    it("counts an OAuth sign-up once per tab", async () => {
        const { analytics, funnel, consent } = await load();
        consent.chooseConsent("accepted");
        await analytics.whenReady();
        posthog.capture.mockClear();
        funnel.trackSignupCompleted("google", "oauth");
        funnel.trackSignupCompleted("google", "oauth");
        expect(posthog.capture).toHaveBeenCalledTimes(1);
    });

    it("holds the first-touch campaign values in sessionStorage only, and sends only the five keys", async () => {
        const { analytics, funnel, consent } = await load(
            "?utm_source=newsletter&utm_medium=email&utm_campaign=launch&utm_content=a&utm_term=ai&utm_id=9&gclid=G&token=SECRET"
        );
        expect(sessionStorage.length).toBe(0); // before Accept
        consent.chooseConsent("accepted");
        await analytics.whenReady();

        const stored = JSON.parse(sessionStorage.getItem("genos-first-touch-utm:v1") ?? "null");
        expect(stored).toEqual({
            utm_source: "newsletter",
            utm_medium: "email",
            utm_campaign: "launch",
            utm_content: "a",
            utm_term: "ai",
        });
        // Not in localStorage, and nothing else is kept beyond the consent record.
        expect(Object.keys(localStorage)).toEqual([
            "genos-marketing-consent:v1",
            "genos-analytics-preferences:v1",
        ]);

        // A later page does not replace the first touch.
        window.history.replaceState({}, "", "/for-teams?utm_source=other");
        funnel.trackMarketingPageview("/for-teams", "en");
        const [name, props] = lastEvent();
        const sent = throughBeforeSend(name, props).properties;
        expect(sent).toMatchObject({
            utm_source: "newsletter",
            utm_medium: "email",
            utm_campaign: "launch",
            utm_content: "a",
            utm_term: "ai",
        });
        expect(sent).not.toHaveProperty("utm_id");
        expect(sent).not.toHaveProperty("gclid");
        expect(JSON.stringify(sent)).not.toContain("SECRET");

        funnel.trackSignupCompleted("email");
        const [signup, signupProps] = lastEvent();
        expect(throughBeforeSend(signup, signupProps).properties).toMatchObject({
            method: "email",
            utm_source: "newsletter",
        });
    });

    it("drops a campaign value that is too long or has unexpected characters", async () => {
        const long = "a".repeat(101);
        const { analytics, funnel, consent } = await load(
            `?utm_source=${long}&utm_medium=<script>&utm_campaign=ok-1_2.3`
        );
        consent.chooseConsent("accepted");
        await analytics.whenReady();
        funnel.trackMarketingPageview("/plans", "en");
        const [name, props] = lastEvent();
        const sent = throughBeforeSend(name, props).properties;
        expect(sent.utm_campaign).toBe("ok-1_2.3");
        expect(sent).not.toHaveProperty("utm_source");
        expect(sent).not.toHaveProperty("utm_medium");
    });
});

describe("Reject (and withdrawing after Accept)", () => {
    it("deletes what the library stored and the campaign values, and keeps the choice", async () => {
        const { analytics, consent } = await load("?utm_source=newsletter");
        consent.chooseConsent("accepted");
        await analytics.whenReady();

        // What posthog-js leaves behind (names probed with 1.445.4).
        localStorage.setItem("ph_phc_test_posthog", "{}");
        localStorage.setItem("__ph_opt_in_out_phc_test", "0");
        sessionStorage.setItem("ph_phc_test_posthog", "{}");
        sessionStorage.setItem("ph_phc_test_window_id", "w");
        document.cookie = "ph_phc_test_posthog=%7B%7D; path=/";
        expect(document.cookie).toContain("ph_phc_test_posthog");

        consent.chooseConsent("rejected");
        await analytics.whenReady();

        expect(Object.keys(localStorage).sort()).toEqual([
            "genos-analytics-preferences:v1",
            "genos-marketing-consent:v1",
        ]);
        expect(JSON.parse(localStorage.getItem("genos-analytics-preferences:v1") ?? "")).toEqual({
            enabled: false,
        });
        expect(sessionStorage.length).toBe(0);
        expect(document.cookie).not.toContain("ph_");
        expect(posthog.opt_out_capturing).toHaveBeenCalled();

        // Off means off: nothing more leaves.
        posthog.capture.mockClear();
        analytics.capture("$pageview", { path: "/plans" });
        expect(posthog.capture).not.toHaveBeenCalled();
    });
});
