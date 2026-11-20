/**
 * The consent banner and the footer control of the marketing pages (MIP-1778). Counsel
 * (2026-11-21): for EU/UK visitors a banner is needed. Until "Accept": the library is not
 * started, nothing of PostHog's is stored, nothing is sent. All wording is a DRAFT for counsel
 * and the owner (marked TODO(copy) in ConsentBanner / LpShell).
 *
 * `services/analytics` is replaced by an in-memory stand-in that keeps the real contract
 * (the stored preference key, `startWithConsent`, `forgetStoredIdentifiers`); the real wrapper
 * and the sanitizer are covered in MarketingFunnel.test.ts.
 */
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { startAnalyticsOutsideMarketing } from "../components/AnalyticsRouteGate";
import { LpShell } from "../lp/kit/LpShell";

const PREF_KEY = "genos-analytics-preferences:v1";
const CONSENT_KEY = "genos-marketing-consent:v1";

const fake = vi.hoisted(() => ({
    configured: true,
    startWithConsent: vi.fn(),
    forgetStoredIdentifiers: vi.fn(),
    capture: vi.fn(),
    init: vi.fn(),
}));

vi.mock("../services/analytics", () => ({
    ANALYTICS_EVENTS: {
        PAGEVIEW: "$pageview",
        CTA_CLICKED: "cta_clicked",
        SIGNUP_COMPLETED: "signup_completed",
    },
    analytics: {
        isConfigured: () => fake.configured,
        isActive: () => true,
        readStoredEnabled: () => {
            const raw = localStorage.getItem("genos-analytics-preferences:v1");
            return raw ? JSON.parse(raw).enabled !== false : true;
        },
        persistEnabled: (enabled: boolean) =>
            localStorage.setItem("genos-analytics-preferences:v1", JSON.stringify({ enabled })),
        startWithConsent: fake.startWithConsent,
        forgetStoredIdentifiers: fake.forgetStoredIdentifiers,
        capture: fake.capture,
        init: fake.init,
    },
}));

const renderShell = (lang: "ja" | "en", path = "/plans") => {
    localStorage.setItem("genos-locale", lang);
    return render(
        <MemoryRouter initialEntries={[path]}>
            <LpShell active={null}>
                {() => (
                    <a data-cta="hero_try_demo" href="/signin">
                        Try
                    </a>
                )}
            </LpShell>
        </MemoryRouter>
    );
};

const banner = () => screen.queryByRole("region", { name: /Cookie and analytics consent/ });
const consent = () => JSON.parse(localStorage.getItem(CONSENT_KEY) ?? "null");
const pref = () => JSON.parse(localStorage.getItem(PREF_KEY) ?? "null");

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    vi.clearAllMocks();
    fake.configured = true;
});

describe("first visit", () => {
    it("shows the banner, and stores and starts nothing", () => {
        renderShell("en");
        expect(banner()).not.toBeNull();
        expect(screen.getByRole("link", { name: "Privacy policy" }).getAttribute("href")).toBe(
            "/privacy"
        );
        // Only the language the visitor's browser resolved may be written; no choice, no pref.
        expect(localStorage.getItem(CONSENT_KEY)).toBeNull();
        expect(localStorage.getItem(PREF_KEY)).toBeNull();
        expect(Object.keys(localStorage).filter((k) => /^(ph_|__ph_)/.test(k))).toEqual([]);
        expect(fake.startWithConsent).not.toHaveBeenCalled();
        expect(fake.init).not.toHaveBeenCalled();
        expect(fake.capture).not.toHaveBeenCalled();
    });

    it("gives Accept and Reject the same class, as real buttons, in the order Accept, Reject", () => {
        renderShell("en");
        const accept = screen.getByRole("button", { name: "Accept" });
        const reject = screen.getByRole("button", { name: "Reject" });
        expect(accept.tagName).toBe("BUTTON");
        expect(reject.tagName).toBe("BUTTON");
        expect(accept.className).toBe(reject.className);
        expect(accept.getAttribute("type")).toBe("button");
        // Right after the skip link, before the header: reachable first by keyboard.
        const focusable = Array.from(
            document.querySelectorAll<HTMLElement>("a[href], button")
        ).map((el) => el.textContent?.trim());
        expect(focusable[0]).toBe("Skip to content");
        expect(focusable.slice(1, 4)).toEqual(["Privacy policy", "Accept", "Reject"]);
    });

    it("is in the page flow, not a dialog and not focus-trapping", () => {
        renderShell("en");
        expect(screen.queryByRole("dialog")).toBeNull();
        expect(banner()?.getAttribute("aria-modal")).toBeNull();
        expect(document.activeElement).toBe(document.body);
    });

    it("is available in Japanese, with the same two equal buttons", () => {
        renderShell("ja");
        const accept = screen.getByRole("button", { name: "同意する" });
        const reject = screen.getByRole("button", { name: "拒否する" });
        expect(accept.className).toBe(reject.className);
    });

    it("is not shown when no analytics key was built in (nothing to consent to)", () => {
        fake.configured = false;
        renderShell("en");
        expect(banner()).toBeNull();
        expect(screen.queryByRole("button", { name: /settings/ })).toBeNull();
    });

    it("is shown again for a visitor whose preference provider wrote {enabled:true} without a choice", () => {
        // The app's AnalyticsPreferencesProvider writes this for every signed-in user on mount.
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: true }));
        renderShell("en");
        expect(banner()).not.toBeNull();
        expect(fake.startWithConsent).not.toHaveBeenCalled();
        startAnalyticsOutsideMarketing("/plans");
        expect(fake.startWithConsent).not.toHaveBeenCalled();
    });

    it("does not nag a visitor who already switched analytics off in Settings", () => {
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        renderShell("en");
        expect(banner()).toBeNull();
        expect(screen.getByRole("status").textContent).toBe("");
    });
});

describe("Reject", () => {
    it("persists the choice, turns analytics off (in the app too) and clears what was stored", () => {
        const { unmount } = renderShell("en");
        fireEvent.click(screen.getByRole("button", { name: "Reject" }));

        expect(consent()).toEqual({ choice: "rejected", v: 1 });
        expect(pref()).toEqual({ enabled: false });
        expect(fake.startWithConsent).not.toHaveBeenCalled();
        expect(fake.forgetStoredIdentifiers).toHaveBeenCalledTimes(1);
        expect(banner()).toBeNull();
        expect(screen.getByRole("status").textContent).toMatch(/Analytics is off/);

        // Across pages and reloads: a fresh mount shows no banner and starts nothing.
        unmount();
        renderShell("en", "/home");
        expect(banner()).toBeNull();
        startAnalyticsOutsideMarketing("/home");
        startAnalyticsOutsideMarketing("/plans");
        expect(fake.startWithConsent).not.toHaveBeenCalled();
        // The signed-in app honours it as well: the Settings preference is off.
        expect(pref()).toEqual({ enabled: false });
    });
});

describe("Accept", () => {
    it("starts analytics on this page, sends the page view and stores only the choice", () => {
        renderShell("en", "/plans");
        expect(fake.capture).not.toHaveBeenCalled();
        fireEvent.click(screen.getByRole("button", { name: "Accept" }));

        expect(consent()).toEqual({ choice: "accepted", v: 1 });
        expect(pref()).toEqual({ enabled: true });
        expect(fake.startWithConsent).toHaveBeenCalledTimes(1);
        expect(banner()).toBeNull();
        expect(fake.capture).toHaveBeenCalledWith("$pageview", { path: "/plans", lang: "en" });
        expect(screen.getByRole("status").textContent).toMatch(/Analytics is on/);
    });

    it("starts on the next marketing page, and sends a page view for it", () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        renderShell("ja", "/home");
        expect(banner()).toBeNull();
        expect(fake.capture).toHaveBeenCalledWith("$pageview", { path: "/home", lang: "ja" });
        startAnalyticsOutsideMarketing("/home");
        expect(fake.startWithConsent).toHaveBeenCalledTimes(1);
    });

    it("is overridden by turning analytics off in Settings", () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        renderShell("en", "/home");
        expect(fake.capture).not.toHaveBeenCalled();
        startAnalyticsOutsideMarketing("/home");
        expect(fake.startWithConsent).not.toHaveBeenCalled();
    });
});

describe("button clicks", () => {
    it("reports a data-cta press after Accept, with only cta, page and lang", () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        renderShell("en", "/plans");
        fake.capture.mockClear();
        fireEvent.click(screen.getByText("Try"));
        expect(fake.capture).toHaveBeenCalledTimes(1);
        const [event, props, options] = fake.capture.mock.calls[0];
        expect(event).toBe("cta_clicked");
        expect(props).toEqual({ cta: "hero_try_demo", page: "/plans", lang: "en" });
        expect(options).toEqual({ transport: "sendBeacon", send_instantly: true });
    });

    it("reports nothing before Accept", () => {
        renderShell("en", "/plans");
        fireEvent.click(screen.getByText("Try"));
        expect(fake.capture).not.toHaveBeenCalled();
    });

    it("reports nothing for an element without a data-cta", () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        renderShell("en", "/plans");
        fake.capture.mockClear();
        fireEvent.click(screen.getAllByRole("link", { name: "Pricing", hidden: true })[0]);
        expect(fake.capture).not.toHaveBeenCalled();
    });
});

describe("the footer control", () => {
    it("reopens the choice, moves focus to it, and Reject then turns analytics off", () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "accepted", v: 1 }));
        renderShell("en", "/home");
        expect(banner()).toBeNull();
        const control = screen.getByRole("button", { name: "Cookie and analytics settings" });
        expect(control.closest("footer")).not.toBeNull();

        fireEvent.click(control);
        expect(banner()).not.toBeNull();
        expect(document.activeElement).toBe(banner());

        fireEvent.click(screen.getByRole("button", { name: "Reject" }));
        expect(consent()).toEqual({ choice: "rejected", v: 1 });
        expect(pref()).toEqual({ enabled: false });
        expect(fake.forgetStoredIdentifiers).toHaveBeenCalledTimes(1);
        expect(banner()).toBeNull();
        // Focus goes back to where the visitor was.
        expect(document.activeElement).toBe(control);
    });

    it("can turn analytics back on from a rejection", () => {
        localStorage.setItem(CONSENT_KEY, JSON.stringify({ choice: "rejected", v: 1 }));
        localStorage.setItem(PREF_KEY, JSON.stringify({ enabled: false }));
        renderShell("en", "/home");
        fireEvent.click(screen.getByRole("button", { name: "Cookie and analytics settings" }));
        fireEvent.click(screen.getByRole("button", { name: "Accept" }));
        expect(consent()).toEqual({ choice: "accepted", v: 1 });
        expect(pref()).toEqual({ enabled: true });
        expect(fake.startWithConsent).toHaveBeenCalledTimes(1);
    });

    it("is labelled in Japanese too", () => {
        renderShell("ja");
        expect(screen.getByRole("button", { name: "Cookie・分析の設定" })).toBeTruthy();
    });
});

describe("the signed-in app", () => {
    it.each(["/signin", "/signup", "/workspace/chat/1", "/jointeam"])(
        "still starts analytics on %s whatever was chosen on a marketing page",
        (path) => {
            startAnalyticsOutsideMarketing(path);
            expect(fake.init).toHaveBeenCalledTimes(1);
            expect(fake.startWithConsent).not.toHaveBeenCalled();
        }
    );
});
