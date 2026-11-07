/**
 * `/support` — how to get help.
 *
 * Pins what must not silently drift: the one real contact address (as a
 * mailto link AND as plain text), that the page renders for a visitor with no
 * auth context at all, that the "Connected AI apps" steps quote the labels the
 * app really shows (compared against the en and ja locale files, so a rename
 * there fails here), the links to /privacy and /legal, and that the route is
 * registered outside the auth stack. Also pins what the page must NOT claim.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it } from "vitest";

import { en } from "../i18n/locales/en";
import { ja } from "../i18n/locales/ja";
import { SUPPORT_EMAIL, SUPPORT_UI_LABELS } from "../lp/supportLabels";
import SupportPage from "../lp/SupportPage";

const renderPage = () =>
    render(
        <MemoryRouter>
            <SupportPage />
        </MemoryRouter>
    );

beforeEach(() => {
    // The starting language follows the app's stored/browser locale.
    localStorage.clear();
});

describe("SupportPage", () => {
    it("renders for a logged-out visitor, with no auth or i18n provider around it", () => {
        // Nothing but a router: no AuthProvider, no I18nProvider, no token.
        localStorage.removeItem("isSigningIn");
        renderPage();
        expect(screen.getByRole("heading", { level: 1, name: "Support" })).toBeTruthy();
    });

    it("gives the support address as a mailto link and as plain text", () => {
        const { container } = renderPage();
        expect(SUPPORT_EMAIL).toBe("genos.support@genosai.dev");
        const link = screen.getByRole("link", { name: SUPPORT_EMAIL });
        expect(link.getAttribute("href")).toBe(`mailto:${SUPPORT_EMAIL}`);
        // The address also appears as plain text OUTSIDE the link, to copy if the link does nothing.
        const plain = screen.getByTestId("support-email-text");
        expect(plain.textContent).toBe(SUPPORT_EMAIL);
        expect(plain.closest("a")).toBeNull();
        // It is the only mailto on the page.
        expect(container.querySelectorAll('a[href^="mailto:"]').length).toBe(1);
    });

    it("says what to include when writing", () => {
        renderPage();
        expect(screen.getByText(/email address of your Genos account/)).toBeTruthy();
        expect(screen.getByText(/What you were doing/)).toBeTruthy();
        expect(screen.getByText(/Any error message/)).toBeTruthy();
        expect(screen.getByText(/which app it is/)).toBeTruthy();
    });

    it("tells a member how to see and disconnect a connected app, quoting the app's labels", () => {
        const { container } = renderPage();
        const text = container.textContent ?? "";
        expect(screen.getByRole("heading", { name: "Connected AI apps" })).toBeTruthy();
        // Quote the labels exactly as the Settings screen shows them.
        const labels = SUPPORT_UI_LABELS.en;
        expect(labels.settings).toBe(en.settings.title);
        expect(labels.developer).toBe(en.settings.tabs.developer);
        expect(labels.connectedApps).toBe(en.settings.connectedApps.title);
        expect(labels.change).toBe(en.settings.connectedApps.change);
        expect(labels.revoke).toBe(en.settings.connectedApps.revoke);
        expect(labels.scopeRead).toBe(en.settings.connectedApps.scopeRead);
        expect(labels.scopeWrite).toBe(en.settings.connectedApps.scopeWrite);
        expect(labels.canDelete).toBe(en.settings.connectedApps.canDelete);
        for (const label of Object.values(labels)) expect(text).toContain(label);
    });

    it("quotes the Japanese labels from the ja locale when switched to 日本語", () => {
        const { container } = renderPage();
        fireEvent.click(screen.getByRole("button", { name: "日本語" }));
        const text = container.textContent ?? "";
        const labels = SUPPORT_UI_LABELS.ja;
        expect(labels.settings).toBe(ja.settings?.title);
        expect(labels.developer).toBe(ja.settings?.tabs?.developer);
        expect(labels.connectedApps).toBe(ja.settings?.connectedApps?.title);
        expect(labels.change).toBe(ja.settings?.connectedApps?.change);
        expect(labels.revoke).toBe(ja.settings?.connectedApps?.revoke);
        expect(labels.scopeRead).toBe(ja.settings?.connectedApps?.scopeRead);
        expect(labels.scopeWrite).toBe(ja.settings?.connectedApps?.scopeWrite);
        expect(labels.canDelete).toBe(ja.settings?.connectedApps?.canDelete);
        for (const label of Object.values(labels)) expect(text).toContain(label);
        // The address is still there in the Japanese view.
        expect(screen.getByRole("link", { name: SUPPORT_EMAIL }).getAttribute("href")).toBe(
            `mailto:${SUPPORT_EMAIL}`
        );
    });

    it("links to /privacy and /legal", () => {
        renderPage();
        expect(screen.getByRole("link", { name: "Privacy Policy" }).getAttribute("href")).toBe(
            "/privacy"
        );
        expect(screen.getByRole("link", { name: "Legal Notice" }).getAttribute("href")).toBe(
            "/legal"
        );
    });

    it("does not invent contact channels, response times or a terms link", () => {
        const { container } = renderPage();
        const text = container.textContent ?? "";
        expect(text).not.toMatch(/\b(within|hours?|business days?|24\/7|SLA)\b/i);
        expect(text).not.toMatch(/phone|tel:|\blive chat\b|call us/i);
        expect(container.querySelector("form")).toBeNull();
        expect(container.querySelector('a[href="/terms"]')).toBeNull();
        expect(container.querySelector('a[href^="tel:"]')).toBeNull();
    });
});

describe("/support route registration", () => {
    const main = readFileSync(resolve(__dirname, "../main.tsx"), "utf8");

    it("is a public page, registered before the auth-guarded routes", () => {
        const route = main.indexOf('path="/support"');
        expect(route).toBeGreaterThan(0);
        expect(main.slice(route - 80, route)).toContain("publicPage(GenosSupportPage)");
        // The routes under AuthLayout all come after the public ones.
        expect(route).toBeLessThan(main.indexOf("<AuthLayout />"));
    });

    it("does not register a /terms route (the terms are an unpublished draft)", () => {
        expect(main).not.toContain('path="/terms"');
    });
});
