/**
 * `/subprocessors` and `/cookies` (MIP-1251). The subprocessor table is the
 * privacy page's PROCESSORS table, so every processor appears once per language;
 * no region is claimed; the cookie table names what the code really stores.
 */
import { render, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import CookiesPage from "../lp/CookiesPage";
import { PROCESSORS } from "../lp/privacyProcessors";
import SubprocessorsPage from "../lp/SubprocessorsPage";

const renderPage = (ui: React.ReactElement) => render(<MemoryRouter>{ui}</MemoryRouter>);

describe("SubprocessorsPage", () => {
    it("lists every processor in both languages, with region not stated", () => {
        const { container } = renderPage(<SubprocessorsPage />);
        const main = within(container);
        for (const p of PROCESSORS) {
            // One row per language section.
            expect(main.getAllByRole("rowheader", { name: p.name }).length).toBe(2);
        }
        expect(container.textContent).not.toMatch(/Tokyo|Singapore|US-|EU-|asia-|us-central/i);
        expect(main.getAllByText("未記載").length).toBe(PROCESSORS.length);
        expect(main.getAllByText("not stated").length).toBe(PROCESSORS.length);
    });

    it("links to the privacy and cookie pages", () => {
        const { container } = renderPage(<SubprocessorsPage />);
        const hrefs = Array.from(container.querySelectorAll("a")).map((a) =>
            a.getAttribute("href")
        );
        expect(hrefs).toContain("/privacy");
        expect(hrefs).toContain("/cookies");
    });
});

describe("CookiesPage", () => {
    it("names the sign-in cookie and the consent and analytics storage", () => {
        const { container } = renderPage(<CookiesPage />);
        const text = container.textContent ?? "";
        expect(text).toContain("refresh");
        expect(text).toContain("genos-marketing-consent:v1");
        expect(text).toContain("genos-analytics-preferences:v1");
        expect(text).toContain("genos-first-touch-utm:v1");
        expect(text).toContain("ph_…");
        expect(text).toContain("広告目的の Cookie は使用しません");
        expect(text).toContain("We do not set advertising cookies");
        // Analytics identifiers only after consent, in both languages.
        expect(text).toContain("分析に同意した後のみ保存されます");
        expect(text).toContain("Only after you accept analytics");
    });
});
