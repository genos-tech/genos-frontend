/**
 * The rebuilt marketing pages (MIP-1232): what must stay true however they are restyled.
 *
 * Layout is not testable here (jsdom measures nothing), so these pin the things a redesign breaks
 * silently: copy that went stale or got dropped in one language, a claim about something that is
 * not shipped, the word "MVP" (Ken, 2026-11-08), a screenshot that is declared but missing, and the
 * language handoff into the app.
 */
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { HOME_COPY } from "../lp/copy/home";
import { SHOT_NAMES } from "../lp/kit/shots";
import LandingPage from "../lp/LandingPage";
import { MCP_TOOLS } from "../lp/mcpTools";
import SegmentLandingPage from "../lp/SegmentLandingPage";
import { SEGMENTS } from "../lp/segments";

const setLanguage = (value: string) =>
    vi.spyOn(navigator, "language", "get").mockReturnValue(value);

beforeEach(() => {
    localStorage.clear();
    window.history.replaceState({}, "", "/home");
});
afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

const renderHome = () =>
    render(
        <MemoryRouter>
            <LandingPage />
        </MemoryRouter>
    );

describe("/home", () => {
    it("opens in the visitor's language with one h1 and no MVP anywhere", () => {
        setLanguage("ja-JP");
        const { container } = renderHome();
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
            HOME_COPY.ja.hero.title
        );
        expect(container.textContent).not.toMatch(/MVP/);
    });

    it("switching language swaps the whole page and the document title", () => {
        setLanguage("en-US");
        renderHome();
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
            HOME_COPY.en.hero.title
        );
        fireEvent.click(screen.getByRole("button", { name: "日本語" }));
        expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
            HOME_COPY.ja.hero.title
        );
        expect(document.title).toBe(HOME_COPY.ja.meta.title);
    });

    it("states the real MCP tool count, from the developers page list, not a typed number", () => {
        setLanguage("en-US");
        renderHome();
        expect(MCP_TOOLS.length).toBeGreaterThan(50);
        expect(document.body.textContent).toContain(`${MCP_TOOLS.length} tools`);
    });

    it("keeps what is not shipped labelled as coming, in both languages", () => {
        for (const lang of ["en", "ja"] as const) {
            const copy = HOME_COPY[lang];
            // The ChatGPT row and the two secretary lines that do not exist yet.
            expect(copy.mcp.clients.filter((c) => c.coming).map((c) => c.name)).toEqual([
                "ChatGPT",
            ]);
            expect(copy.secretary.points.filter((p) => p.coming)).toHaveLength(2);
        }
    });

    it("every call to action carries the language once the visitor picked one", () => {
        setLanguage("en-US");
        renderHome();
        fireEvent.click(screen.getByRole("button", { name: "日本語" }));
        const demo = screen
            .getAllByRole("link", { name: HOME_COPY.ja.hero.primary })
            .map((a) => a.getAttribute("href"));
        expect(demo.length).toBeGreaterThan(0);
        for (const href of demo) expect(href).toContain("lang=ja");
    });

    it("the tabs follow the keyboard (arrow keys move and select)", () => {
        setLanguage("en-US");
        renderHome();
        const tabs = screen.getAllByRole("tab");
        expect(tabs[0].getAttribute("aria-selected")).toBe("true");
        fireEvent.keyDown(tabs[0], { key: "ArrowRight" });
        expect(screen.getAllByRole("tab")[1].getAttribute("aria-selected")).toBe("true");
        expect(screen.getByRole("tabpanel").getAttribute("aria-labelledby")).toBe(
            screen.getAllByRole("tab")[1].id
        );
    });

    it("the header has the nav, a language group and a mode toggle that are named", () => {
        setLanguage("en-US");
        renderHome();
        const header = screen.getAllByRole("banner")[0];
        expect(within(header).getAllByRole("navigation").length).toBeGreaterThan(0);
        expect(within(header).getByRole("group", { name: "Language" })).toBeTruthy();
        expect(within(header).getByRole("button", { name: /dark mode/i })).toBeTruthy();
    });
});

describe("audience pages", () => {
    it.each(Object.keys(SEGMENTS) as Array<keyof typeof SEGMENTS>)(
        "%s renders in both languages, complete, with no MVP and with its coming items labelled",
        (segment) => {
            for (const lang of ["en", "ja"] as const) {
                const copy = SEGMENTS[segment][lang];
                expect(copy.features).toHaveLength(3);
                expect(copy.faq.items.length).toBeGreaterThanOrEqual(3);
                expect(copy.coming.length).toBeGreaterThan(0);
                expect(copy.now.length).toBeGreaterThan(0);

                setLanguage(lang === "ja" ? "ja-JP" : "en-US");
                window.history.replaceState({}, "", SEGMENTS[segment].route);
                const { container, unmount } = render(
                    <MemoryRouter>
                        <SegmentLandingPage segment={segment} />
                    </MemoryRouter>
                );
                expect(screen.getByRole("heading", { level: 1 }).textContent).toBe(
                    copy.hero.title
                );
                expect(container.textContent).not.toMatch(/MVP/);
                // Two tasks the old copy called "not available" shipped since: reminders.
                expect(JSON.stringify(copy.faq)).not.toMatch(/not currently available/);
                unmount();
            }
        }
    );
});

describe("screenshots", () => {
    const root = join(__dirname, "..", "..", "public", "lp", "shots");

    it("every declared screenshot exists in both languages at 1x and 2x", () => {
        const missing: string[] = [];
        for (const lang of ["ja", "en"]) {
            for (const name of SHOT_NAMES) {
                for (const file of [`${name}.webp`, `${name}@2x.webp`]) {
                    if (!existsSync(join(root, lang, file))) missing.push(`${lang}/${file}`);
                }
            }
        }
        expect(missing).toEqual([]);
    });
});

describe("wording", () => {
    // Ken, 2026-11-08: Genos is not called an MVP anymore. The blog articles are synced from
    // genos-docs/marketing (`npm run blog:sync`), so this also catches a stale source coming back.
    it('no text under src/lp calls anything an "MVP"', () => {
        const root = join(__dirname, "..", "lp");
        const found: string[] = [];
        const walk = (dir: string) => {
            for (const name of readdirSync(dir)) {
                const path = join(dir, name);
                if (statSync(path).isDirectory()) walk(path);
                else if (
                    /\.(tsx?|md|json)$/.test(name) &&
                    /\bMVP\b/.test(readFileSync(path, "utf8"))
                )
                    found.push(path.slice(root.length + 1));
            }
        };
        walk(root);
        expect(found).toEqual([]);
    });
});
