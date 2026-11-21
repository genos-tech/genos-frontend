/**
 * `/accessibility` (MIP-1265): the copy is complete in both languages, the
 * support address is the one the site already uses, the statement names the
 * known gaps, and it never uses the words the messaging brief bans.
 */
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { describe, expect, it } from "vitest";

import { ACCESSIBILITY_COPY } from "../lp/copy/accessibility";
import { buildHeadTags, pageUrl } from "../lp/seo/head";
import { ACCESSIBILITY_META } from "../lp/seo/pageMeta";
import { LP_ROUTES, routeFor } from "../lp/seo/routes";
import { SUPPORT_EMAIL } from "../lp/supportLabels";

const flatten = (lang: "en" | "ja") => {
    const c = ACCESSIBILITY_COPY[lang];
    return JSON.stringify(c);
};

describe("accessibility copy", () => {
    it("has the same sections, with text, in English and Japanese", () => {
        for (const lang of ["en", "ja"] as const) {
            const c = ACCESSIBILITY_COPY[lang];
            for (const section of Object.values(c.sections)) {
                expect(section.heading.length).toBeGreaterThan(0);
                expect(section.body.length).toBeGreaterThan(0);
                for (const p of section.body) expect(p.trim().length).toBeGreaterThan(0);
            }
        }
        expect(Object.keys(ACCESSIBILITY_COPY.en.sections).sort()).toEqual(
            Object.keys(ACCESSIBILITY_COPY.ja.sections).sort()
        );
        for (const lang of ["en", "ja"] as const) {
            const k = Object.keys(ACCESSIBILITY_COPY[lang].sections) as Array<
                keyof typeof ACCESSIBILITY_COPY.en.sections
            >;
            for (const key of k) {
                expect(ACCESSIBILITY_COPY[lang].sections[key].body.length).toBe(
                    ACCESSIBILITY_COPY[lang === "en" ? "ja" : "en"].sections[key].body.length
                );
            }
        }
    });

    it("never names the banned product word, in either language", () => {
        for (const lang of ["en", "ja"] as const) {
            expect(flatten(lang)).not.toMatch(/secretary/i);
            expect(flatten(lang)).not.toContain("秘書");
        }
    });

    it("states the known gaps and never claims a screen reader test", () => {
        const gaps = ACCESSIBILITY_COPY.en.sections.gaps.body.join(" ");
        expect(gaps).toMatch(/screen reader/i);
        expect(gaps).toMatch(/axe/);
        expect(ACCESSIBILITY_COPY.en.sections.browsers.body.join(" ")).toMatch(/Chromium only/);
    });

    it("never prints an internal task id on the public page", () => {
        expect(flatten("en")).not.toMatch(/MIP-\d/);
        expect(flatten("ja")).not.toMatch(/MIP-\d/);
    });

    it("reports problems to the support address the site already uses", () => {
        expect(SUPPORT_EMAIL).toBe("genos.support@genosai.dev");
        expect(flatten("en")).not.toContain("@");
    });
});

describe("accessibility route and meta", () => {
    it("is a bilingual toggle page in the route list", () => {
        expect(routeFor("/accessibility")?.langs).toBe("toggle");
        expect(LP_ROUTES.map((r) => r.path)).toContain("/accessibility");
    });

    it("has a title and description in both languages, with an alternate pair", () => {
        for (const lang of ["en", "ja"] as const) {
            expect(ACCESSIBILITY_META[lang].title.length).toBeGreaterThan(0);
            expect(ACCESSIBILITY_META[lang].description.length).toBeGreaterThan(20);
            const tags = buildHeadTags({
                ...ACCESSIBILITY_META[lang],
                ogTitle: ACCESSIBILITY_META[lang].title,
                ogDescription: ACCESSIBILITY_META[lang].description,
                path: "/accessibility",
                lang,
            });
            const canonical = tags.find((t) => t.kind === "link" && t.rel === "canonical");
            expect(canonical && canonical.kind === "link" && canonical.href).toBe(
                pageUrl("/accessibility", lang)
            );
            const alternates = tags.filter((t) => t.kind === "link" && t.rel === "alternate");
            expect(alternates).toHaveLength(3);
        }
    });
});

describe("accessibility page render", () => {
    it("renders the statement with the support address (language follows the stored locale)", async () => {
        const { default: AccessibilityPage } = await import("../lp/AccessibilityPage");
        render(
            <MemoryRouter initialEntries={["/accessibility?lang=ja"]}>
                <AccessibilityPage />
            </MemoryRouter>
        );
        expect([ACCESSIBILITY_COPY.en.title, ACCESSIBILITY_COPY.ja.title]).toContain(
            screen.getByRole("heading", { level: 1 }).textContent
        );
        expect(screen.getAllByRole("link", { name: SUPPORT_EMAIL }).length).toBeGreaterThan(0);
    });
});
