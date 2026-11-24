/**
 * The in-app analytics consent (MIP-1781): the real `analytics` wrapper, the real consent
 * record, the real prompt, hooks and Settings switch, with posthog-js replaced by a recorder.
 *
 * Counsel (2026-11-21): consent is needed. In the app analytics is off until "Accept", for a
 * new user, an existing user (their old on-by-default is not a choice) and a visitor who
 * did not answer on a marketing page; a choice made on a marketing page holds in the app.
 * Nothing of PostHog's is loaded, stored or sent before "Accept".
 */
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Every test re-imports the whole Settings tree after `vi.resetModules()`. On a busy CI shard
// the first import takes longer than the 5 s default, the test times out, and its half-mounted
// prompt then makes the next test see two "Accept" buttons (MIP-2059).
vi.setConfig({ testTimeout: 30_000 });

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

const PREF_KEY = "genos-analytics-preferences:v1";
const CONSENT_KEY = "genos-marketing-consent:v1";
const ME = { userId: "user-1", teamId: "team-1", role: "admin" } as never;

// The wrapper keeps module state (started, queue), and React must be the same copy as the
// components, so every test loads a fresh copy of all of them together.
let current: { cleanup: () => void } | null = null;
const load = async () => {
    vi.resetModules();
    const rtl = await import("@testing-library/react");
    current = rtl;
    return {
        ...rtl,
        analytics: (await import("../services/analytics")).analytics,
        consent: await import("../services/marketingConsent"),
        Prompt: (await import("../components/layout/AnalyticsConsentPrompt"))
            .AnalyticsConsentPrompt,
        Provider: (await import("../hooks/common/useAnalyticsPreferences"))
            .AnalyticsPreferencesProvider,
        useAnalyticsIdentity: (await import("../hooks/common/useAnalyticsIdentity"))
            .useAnalyticsIdentity,
        useAnalyticsPageviews: (await import("../hooks/common/useAnalyticsPageviews"))
            .useAnalyticsPageviews,
        PrivacySection: (await import("../components/layout/SettingsModal")).PrivacySection,
        auth: await import("../context/authState"),
    };
};
type Loaded = Awaited<ReturnType<typeof load>>;

/** The properties of every `$pageview` captured (a call replayed after the chunk loaded has a 3rd argument). */
const pageviews = () =>
    posthog.capture.mock.calls.filter(([name]) => name === "$pageview").map(([, props]) => props);
const phKeys = (): string[] =>
    [...Object.keys(localStorage), ...Object.keys(sessionStorage)].filter((k) =>
        /^(ph_|__ph_)/.test(k)
    );
const choice = () => JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null");
const pref = () => JSON.parse(localStorage.getItem(PREF_KEY) ?? "null");
const prompt = (m: Loaded) => m.screen.queryByRole("region", { name: "Analytics consent" });

afterEach(() => current?.cleanup());

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    vi.stubEnv("VITE_POSTHOG_KEY", "phc_test");
    vi.stubEnv("VITE_POSTHOG_HOST", "https://eu.i.posthog.com");
});

/** The app boot: `main.tsx` calls `init()`, then the workspace mounts the prompt and the hooks. */
const bootApp = async (m: Loaded) => {
    m.analytics.init();
    const Tree = () => {
        m.useAnalyticsIdentity(ME);
        m.useAnalyticsPageviews();
        return null;
    };
    m.render(
        <MemoryRouter initialEntries={["/workspace/chat"]}>
            <m.Provider>
                <Tree />
            </m.Provider>
        </MemoryRouter>
    );
    await m.analytics.whenReady();
};

describe.each([
    ["a new user (no stored choice)", () => {}],
    [
        "an existing user (the old on-by-default {enabled:true}, never asked)",
        () => localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: true })),
    ],
])("%s", (_name, seed) => {
    beforeEach(seed);

    it("is asked once, and before Accept loads, stores and sends nothing", async () => {
        const m = await load();
        await bootApp(m);

        expect(prompt(m)).not.toBeNull();
        expect(posthog.init).not.toHaveBeenCalled();
        m.analytics.capture("anything", {});
        m.analytics.identify("user-1", { teamId: "team-1", role: "admin" });
        await m.analytics.whenReady();
        expect(posthog.capture).not.toHaveBeenCalled();
        expect(posthog.identify).not.toHaveBeenCalled();
        expect(phKeys()).toEqual([]);
        expect(document.cookie).not.toMatch(/ph_/);
        expect(m.analytics.isEnabled()).toBe(false);
        expect(choice()).toBeNull();
    });

    it("Accept starts the app configuration, identifies, counts this page, and is not asked again", async () => {
        const m = await load();
        await bootApp(m);

        m.fireEvent.click(m.screen.getByRole("button", { name: "Accept" }));
        await m.analytics.whenReady();

        expect(posthog.init).toHaveBeenCalledTimes(1);
        const options = posthog.init.mock.calls[0][1];
        expect(options).toMatchObject({
            save_referrer: false,
            save_campaign_params: false,
            advanced_disable_flags: true,
            disable_session_recording: true,
        });
        expect(typeof options.before_send).toBe("function");
        // The identity is sent only now, with exactly user id, team id and role.
        expect(posthog.identify).toHaveBeenCalledWith("user-1", {
            role: "admin",
            teamId: "team-1",
        });
        // The page the person is on is counted when they accept.
        expect(pageviews()).toEqual([{ path: "/workspace/chat" }]);
        expect(choice()).toEqual({ choice: "accepted", v: 1 });
        expect(pref()).toEqual({ enabled: true });
        expect(prompt(m)).toBeNull();
        expect(m.analytics.isEnabled()).toBe(true);
    });

    it("Reject starts nothing, deletes what exists, remembers the answer, and is not asked again", async () => {
        const m = await load();
        await bootApp(m);
        localStorage.setItem("ph_phc_test_posthog", "{}");

        m.fireEvent.click(m.screen.getByRole("button", { name: "Reject" }));
        await m.analytics.whenReady();

        expect(posthog.init).not.toHaveBeenCalled();
        expect(posthog.identify).not.toHaveBeenCalled();
        expect(choice()).toEqual({ choice: "rejected", v: 1 });
        expect(pref()).toEqual({ enabled: false });
        expect(phKeys()).toEqual([]);
        expect(prompt(m)).toBeNull();
    });
});

describe("the prompt", () => {
    it("is a region in the page, not a dialog, and takes no focus", async () => {
        const m = await load();
        await bootApp(m);
        expect(m.screen.queryByRole("dialog")).toBeNull();
        expect(prompt(m)?.getAttribute("aria-modal")).toBeNull();
        expect(document.activeElement).toBe(document.body);
        expect(m.screen.getByRole("link", { name: "Privacy policy" }).getAttribute("href")).toBe(
            "/privacy"
        );
    });

    it("gives Accept and Reject the same variant, size and class (equally prominent), Accept first", async () => {
        const m = await load();
        await bootApp(m);
        const buttons = m.screen.getAllByRole("button");
        expect(buttons.map((b) => b.textContent)).toEqual(["Accept", "Reject"]);
        expect(buttons[0].className).toBe(buttons[1].className);
    });

    it("is not shown when no analytics key was built in (nothing to consent to)", async () => {
        vi.stubEnv("VITE_POSTHOG_KEY", "");
        const m = await load();
        await bootApp(m);
        expect(prompt(m)).toBeNull();
    });
});

describe("a returning visitor", () => {
    it("who accepted on a marketing page is not asked, and the app starts at boot with its configuration", async () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        const m = await load();
        await bootApp(m);

        expect(prompt(m)).toBeNull();
        expect(posthog.init).toHaveBeenCalledTimes(1);
        expect(posthog.init.mock.calls[0][1]).toMatchObject({ advanced_disable_flags: true });
        expect(posthog.init.mock.calls[0][1]).toMatchObject({ capture_heatmaps: false });
        expect(posthog.identify).toHaveBeenCalledWith("user-1", {
            role: "admin",
            teamId: "team-1",
        });
        expect(pageviews()).toEqual([{ path: "/workspace/chat" }]);
    });

    it("who rejected on a marketing page is not asked, and nothing is loaded or sent", async () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "rejected", v: 1 }));
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        const m = await load();
        await bootApp(m);

        expect(prompt(m)).toBeNull();
        expect(posthog.init).not.toHaveBeenCalled();
        expect(posthog.identify).not.toHaveBeenCalled();
        expect(phKeys()).toEqual([]);
    });

    it("who switched analytics off in Settings before this change is not asked, and stays off", async () => {
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        const m = await load();
        await bootApp(m);

        expect(prompt(m)).toBeNull();
        expect(posthog.init).not.toHaveBeenCalled();
    });

    it("who accepted but turned the preference off is not asked and not started", async () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        const m = await load();
        await bootApp(m);

        expect(prompt(m)).toBeNull();
        expect(posthog.init).not.toHaveBeenCalled();
    });

    it("keeps the choice at the first sign-in on a browser with no earlier user (the wipe preserves the record)", async () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        localStorage.setItem("someUserData", "x");
        const m = await load();
        m.auth.clearUserScopedLocalStorage();
        expect(choice()).toEqual({ choice: "accepted", v: 1 });
        expect(localStorage.getItem("someUserData")).toBeNull();
    });
});

describe("a different user signing in on the same browser", () => {
    it("is asked: the previous person's Accept is not theirs", async () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        localStorage.setItem("userId", "previous-user");
        const m = await load();
        m.auth.clearUserScopedLocalStorage();
        expect(choice()).toBeNull();
        await bootApp(m);
        expect(prompt(m)).not.toBeNull();
        expect(posthog.init).not.toHaveBeenCalled();
    });

    it("stays off after the previous person's Reject, and is not asked", async () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "rejected", v: 1 }));
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        localStorage.setItem("userId", "previous-user");
        const m = await load();
        m.auth.clearUserScopedLocalStorage();
        expect(choice()).toEqual({ choice: "rejected", v: 1 });
        await bootApp(m);
        expect(prompt(m)).toBeNull();
        expect(posthog.init).not.toHaveBeenCalled();
    });
});

describe("a browser that will not store the choice (private mode, full storage)", () => {
    it("Accept still starts analytics on this page, and the question comes back at the next load", async () => {
        const m = await load();
        await bootApp(m);
        const setItem = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
            throw new Error("QuotaExceededError");
        });
        try {
            m.fireEvent.click(m.screen.getByRole("button", { name: "Accept" }));
            await m.analytics.whenReady();
            expect(posthog.init).toHaveBeenCalledTimes(1);
            expect(prompt(m)).toBeNull();
            expect(m.analytics.isEnabled()).toBe(true);
            expect(choice()).toBeNull(); // nothing was stored
        } finally {
            setItem.mockRestore();
        }
        // The next load: nothing is remembered, so it is asked again and nothing starts.
        const next = await load();
        await bootApp(next);
        expect(prompt(next)).not.toBeNull();
    });
});

describe("the Settings switch", () => {
    const renderSwitch = async (m: Loaded) => {
        m.analytics.init();
        m.render(<m.PrivacySection />);
        return () =>
            m.screen.getByRole("switch", { name: "Share usage data" }) as HTMLInputElement;
    };

    it("shows OFF with no choice (the real state), even for an existing {enabled:true}", async () => {
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: true }));
        const m = await load();
        const sw = await renderSwitch(m);
        expect(sw().checked).toBe(false);
        expect(m.screen.getByText(/Off until you accept/)).not.toBeNull();
        // Reading the state writes nothing: no decision is invented.
        expect(pref()).toEqual({ enabled: true });
        expect(choice()).toBeNull();
    });

    it("turning it on is Accept: the library starts and the choice is stored", async () => {
        const m = await load();
        const sw = await renderSwitch(m);
        m.fireEvent.click(sw());
        await m.analytics.whenReady();
        expect(sw().checked).toBe(true);
        expect(posthog.init).toHaveBeenCalledTimes(1);
        expect(choice()).toEqual({ choice: "accepted", v: 1 });
        expect(pref()).toEqual({ enabled: true });
    });

    it("turning it off is Reject: capture stops and what was stored is deleted", async () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        const m = await load();
        const sw = await renderSwitch(m);
        await m.analytics.whenReady();
        expect(sw().checked).toBe(true);
        localStorage.setItem("ph_phc_test_posthog", "{}");

        m.fireEvent.click(sw());
        await m.analytics.whenReady();
        expect(sw().checked).toBe(false);
        expect(posthog.opt_out_capturing).toHaveBeenCalled();
        expect(choice()).toEqual({ choice: "rejected", v: 1 });
        expect(pref()).toEqual({ enabled: false });
        expect(phKeys()).toEqual([]);
        expect(m.analytics.isEnabled()).toBe(false);
    });

    it("shows ON for a visitor who accepted on a marketing page", async () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        const m = await load();
        const sw = await renderSwitch(m);
        expect(sw().checked).toBe(true);
    });
});
