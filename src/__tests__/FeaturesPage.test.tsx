/**
 * `/features-guide` — the public product guide.
 *
 * The page renders `features.items[key]` for each key in `FEATURE_ORDER`,
 * which means the copy and the order array can disagree in two directions
 * and neither raises anything: a card whose copy exists but whose key was
 * never added to the order **silently does not render**, and a key in the
 * order with no copy renders an empty card. The first is the one that has
 * actually happened — you write the feature up, ship it, and the page
 * looks unchanged.
 *
 * The rest pins the handful of claims that go stale when the product
 * moves underneath them. This page is a marketing surface, so nothing
 * else in the system fails when it starts lying.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { en } from "../i18n/locales/en";
import FeaturesPage from "../lp/FeaturesPage";

const copy = en.featuresPage;
/** Every feature the copy defines. The page must render all of them. */
const FEATURES = Object.keys(copy.features.items) as Array<keyof typeof copy.features.items>;

const renderPage = () =>
    render(
        <MemoryRouter>
            <FeaturesPage />
        </MemoryRouter>
    );

describe("FeaturesPage", () => {
    it("renders every feature that has copy — none can be orphaned", () => {
        // Asserted against the RENDERED page rather than the page's
        // order array, so it catches the real failure directly: copy
        // written for a feature whose key nobody added to `FEATURE_ORDER`
        // produces no card, no error, and no clue.
        renderPage();
        for (const key of FEATURES) {
            const item = copy.features.items[key];
            expect(
                screen.getAllByText(item.title).length,
                `"${item.title}" has copy but never reaches the page — add "${key}" to FEATURE_ORDER`
            ).toBeGreaterThan(0);
        }
    });

    it("describes the service cycle the shortcut actually performs", () => {
        // `useGlobalServiceShortcut` cycles five services; Genos was
        // added and this row said four for a while. A shortcut list that
        // is wrong is worse than one that is absent — the reader tries
        // it, it does something else, and they stop trusting the page.
        renderPage();
        const cycle = copy.shortcuts.items.find((s) => s.keys.includes("tap Ctrl"));
        expect(cycle?.label).toContain("Genos");
        expect(screen.getByText(cycle!.label)).toBeTruthy();
    });

    it("covers the surfaces you can reach Genos from, not only the app", () => {
        // The API, the realtime stream and MCP all shipped after this
        // page was written, and a product guide that stops at the UI
        // undersells the thing it exists to explain.
        renderPage();
        expect(screen.getAllByText(/API/).length).toBeGreaterThan(0);
        expect(screen.getAllByText(/MCP/).length).toBeGreaterThan(0);
    });

    it("has bullets on every feature, so no card renders as a bare title", () => {
        for (const key of FEATURES) {
            const item = copy.features.items[key];
            expect(item.bullets.length, `${key} has no bullets`).toBeGreaterThan(0);
            expect(item.desc.length, `${key} has no description`).toBeGreaterThan(0);
        }
    });
});
