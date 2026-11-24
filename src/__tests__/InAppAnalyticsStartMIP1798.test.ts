/**
 * The in-app start of posthog-js (MIP-1798): the real `analytics` wrapper with posthog-js
 * replaced by a recorder. The app start keeps the landing address and the referrer out of the
 * browser and does not call `/flags/`, like the start after "Accept" on a marketing page.
 */
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

const load = async () => {
    vi.resetModules();
    return (await import("../services/analytics")).analytics;
};

beforeEach(() => {
    localStorage.clear();
    // The app starts analytics only after "Accept" (MIP-1781).
    localStorage.setItem(
        "genos-marketing-consent:v1",
        JSON.stringify({ choice: "accepted", v: 1 })
    );
    vi.clearAllMocks();
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
});

describe("the app start", () => {
    it("stores no landing address or referrer and makes no /flags/ request", async () => {
        const analytics = await load();
        analytics.init();
        await analytics.whenReady();

        expect(posthog.init).toHaveBeenCalledTimes(1);
        expect(posthog.init.mock.calls[0][1]).toMatchObject({
            autocapture: false,
            capture_pageview: false,
            disable_session_recording: true,
            save_referrer: false,
            save_campaign_params: false,
            advanced_disable_flags: true,
        });
        expect(typeof posthog.init.mock.calls[0][1].before_send).toBe("function");
    });

    it("pins every remote-config collection option off in the app too (MIP-2255)", async () => {
        const analytics = await load();
        analytics.init();
        await analytics.whenReady();
        expect(posthog.init.mock.calls[0][1]).toMatchObject({
            autocapture: false,
            disable_session_recording: true,
            capture_heatmaps: false,
            capture_dead_clicks: false,
            capture_exceptions: false,
            disable_surveys: true,
            disable_conversations: true,
            disable_product_tours: true,
            disable_web_experiments: true,
        });
        // The app keeps its device fields (performance timing).
        expect(posthog.init.mock.calls[0][1]).not.toHaveProperty("capture_performance");
    });

    it("deletes the session's stored entry data after every capture, also one queued before the chunk loaded", async () => {
        const analytics = await load();
        analytics.init();
        analytics.capture("$pageview", { path: "/" }); // queued: posthog-js is still loading
        await analytics.whenReady();
        expect(posthog.capture).toHaveBeenCalledTimes(1);
        expect(posthog.unregister).toHaveBeenCalledWith("$client_session_props");

        posthog.unregister.mockClear();
        analytics.capture("demo_started", {});
        expect(posthog.unregister).toHaveBeenCalledTimes(1);
        expect(posthog.unregister).toHaveBeenCalledWith("$client_session_props");
    });

    it("still identifies the signed-in user", async () => {
        const analytics = await load();
        analytics.init();
        analytics.identify("user-1", { teamId: "team-1", role: "member" });
        await analytics.whenReady();
        expect(posthog.identify).toHaveBeenCalledWith("user-1", {
            teamId: "team-1",
            role: "member",
        });
    });
});
