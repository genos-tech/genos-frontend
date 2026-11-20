/**
 * What each public page writes into <head>: title, description, share card
 * (Open Graph + Twitter), canonical, hreflang and <html lang>, in Japanese and
 * English. Rendered for real, at the page's own path, because the facts that
 * go wrong are the ones between the page and the hook: a page that forgot to
 * call it, or called it with the wrong language.
 */
import type { ComponentType } from "react";
import { fireEvent, render, renderHook, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import articlesManifest from "../lp/blog/articles.json";
import { pageUrl } from "../lp/seo/head";
import { SITE_ORIGIN } from "../lp/seo/routes";
import { useDocumentMeta } from "../lp/useDocumentMeta";

const setLanguage = (value: string) =>
    vi.spyOn(navigator, "language", "get").mockReturnValue(value);

const content = (selector: string) =>
    document.head.querySelector(selector)?.getAttribute("content") ?? null;
const href = (selector: string) =>
    document.head.querySelector(selector)?.getAttribute("href") ?? null;

beforeEach(() => {
    localStorage.clear();
    document.head.innerHTML = "<title>Genos</title>";
    document.documentElement.lang = "en";
});
afterEach(() => {
    vi.restoreAllMocks();
    localStorage.clear();
});

describe("useDocumentMeta", () => {
    const Probe = ({ title }: { title: string }) => {
        useDocumentMeta({ title, description: `about ${title}`, lang: "ja", path: "/plans" });
        return null;
    };

    it("writes the full set, and puts the head back when the page goes", () => {
        document.head.innerHTML =
            '<title>Genos</title><meta property="og:title" content="Genos"><meta property="og:image" content="static.png">';
        const { unmount } = render(<Probe title="料金 | Genos" />);

        expect(document.title).toBe("料金 | Genos");
        expect(content('meta[name="description"]')).toBe("about 料金 | Genos");
        expect(content('meta[property="og:title"]')).toBe("料金 | Genos");
        expect(content('meta[property="og:image"]')).toBe(`${SITE_ORIGIN}/genos-share.png`);
        expect(content('meta[property="og:url"]')).toBe(`${SITE_ORIGIN}/plans?lang=ja`);
        expect(content('meta[name="twitter:card"]')).toBe("summary_large_image");
        expect(content('meta[property="og:locale"]')).toBe("ja_JP");
        expect(href('link[rel="canonical"]')).toBe(`${SITE_ORIGIN}/plans?lang=ja`);
        expect(document.documentElement.lang).toBe("ja");
        // one og:title, not two: the static one was updated in place
        expect(document.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);

        unmount();
        expect(document.title).toBe("Genos");
        expect(document.documentElement.lang).toBe("en");
        expect(content('meta[property="og:title"]')).toBe("Genos");
        expect(content('meta[property="og:image"]')).toBe("static.png");
        expect(document.head.querySelector('link[rel="canonical"]')).toBeNull();
        expect(document.head.querySelector('link[rel="alternate"]')).toBeNull();
        expect(document.head.querySelector('meta[name="description"]')).toBeNull();
    });

    it("follows a change of title without piling up tags", () => {
        const { rerender } = render(<Probe title="one" />);
        rerender(<Probe title="two" />);
        expect(document.title).toBe("two");
        expect(document.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
        expect(document.head.querySelectorAll('link[rel="alternate"]')).toHaveLength(3);
    });

    it("still works with the original four fields (the home page's call)", () => {
        window.history.replaceState({}, "", "/home");
        renderHook(() =>
            useDocumentMeta({ title: "T", description: "D", ogTitle: "OT", ogDescription: "OD" })
        );
        expect(document.title).toBe("T");
        expect(content('meta[property="og:description"]')).toBe("OD");
        expect(href('link[rel="canonical"]')).toBe(`${SITE_ORIGIN}/home`);
    });

    it("canonicalises a trailing slash or different case to the page's own URL", () => {
        for (const path of ["/plans/", "/Plans"]) {
            document.head.innerHTML = "<title>Genos</title>";
            const { unmount } = renderHook(() =>
                useDocumentMeta({ title: "T", description: "D", lang: "en", path })
            );
            expect(href('link[rel="canonical"]'), path).toBe(`${SITE_ORIGIN}/plans`);
            expect(href('link[rel="alternate"][hreflang="ja"]'), path).toBe(
                `${SITE_ORIGIN}/plans?lang=ja`
            );
            unmount();
        }
    });

    it("leaves <html lang> alone on a bilingual page", () => {
        document.documentElement.lang = "fr";
        renderHook(() => useDocumentMeta({ title: "T", description: "D", path: "/privacy" }));
        expect(document.documentElement.lang).toBe("fr");
        expect(document.head.querySelector('link[rel="alternate"]')).toBeNull();
    });
});

type PageCase = {
    path: string;
    load: () => Promise<{ default: ComponentType }>;
    langs: "toggle" | "en-only" | "bilingual";
    route?: string;
};

const PAGES: PageCase[] = [
    { path: "/home", load: () => import("../lp/LandingPage"), langs: "toggle" },
    { path: "/features-guide", load: () => import("../lp/FeaturesPage"), langs: "toggle" },
    { path: "/demo-guide", load: () => import("../lp/DemoPage"), langs: "toggle" },
    { path: "/plans", load: () => import("../lp/PlansPage"), langs: "toggle" },
    { path: "/support", load: () => import("../lp/SupportPage"), langs: "toggle" },
    { path: "/developers", load: () => import("../lp/DevelopersPage"), langs: "en-only" },
    { path: "/blog", load: () => import("../lp/BlogPage"), langs: "en-only" },
    { path: "/privacy", load: () => import("../lp/PrivacyPage"), langs: "bilingual" },
    { path: "/legal", load: () => import("../lp/LegalPage"), langs: "bilingual" },
];

const renderAt = async (c: PageCase) => {
    const Page = (await c.load()).default;
    // The previous test's language switch finishes loading a catalog after that test
    // ends and writes the choice to storage again; start from nothing.
    localStorage.clear();
    window.history.replaceState({}, "", c.path);
    return render(
        <MemoryRouter initialEntries={[c.path]}>
            <Routes>
                <Route element={<Page />} path={c.route ?? c.path} />
            </Routes>
        </MemoryRouter>
    );
};

describe.each(PAGES)("$path", (c) => {
    it("sets a real title, description, share card and canonical (English)", async () => {
        setLanguage("en-US");
        await renderAt(c);
        expect(document.title).not.toBe("Genos");
        expect(document.title).toMatch(/Genos/);
        expect(content('meta[name="description"]')?.length).toBeGreaterThan(20);
        expect(content('meta[property="og:title"]')).toBeTruthy();
        expect(content('meta[property="og:description"]')).toBeTruthy();
        expect(content('meta[property="og:image"]')).toBe(`${SITE_ORIGIN}/genos-share.png`);
        expect(content('meta[name="twitter:card"]')).toBe("summary_large_image");
        expect(href('link[rel="canonical"]')).toBe(pageUrl(c.path, "en"));
        expect(content('meta[property="og:url"]')).toBe(pageUrl(c.path, "en"));
        for (const tag of [document.title, content('meta[name="description"]')!]) {
            expect(tag).not.toMatch(/secretary|秘書/i);
        }
    });

    if (c.langs === "toggle") {
        it("serves a Japanese version with its own canonical and the full alternate set", async () => {
            setLanguage("ja-JP");
            await renderAt(c);
            expect(href('link[rel="canonical"]')).toBe(pageUrl(c.path, "ja"));
            expect(document.documentElement.lang).toBe("ja");
            expect(content('meta[property="og:locale"]')).toBe("ja_JP");
            const alt = (l: string) => href(`link[rel="alternate"][hreflang="${l}"]`);
            expect(alt("en")).toBe(pageUrl(c.path, "en"));
            expect(alt("ja")).toBe(pageUrl(c.path, "ja"));
            expect(alt("x-default")).toBe(pageUrl(c.path));
        });

        it("moves canonical, <html lang> and the title when the visitor switches language", async () => {
            setLanguage("en-US");
            await renderAt(c);
            const english = document.title;
            fireEvent.click(screen.getByRole("button", { name: "日本語" }));
            await waitFor(() => expect(href('link[rel="canonical"]')).toBe(pageUrl(c.path, "ja")));
            expect(document.documentElement.lang).toBe("ja");
            expect(document.title).not.toBe(english);
        });
    } else {
        it("claims no alternate version", async () => {
            setLanguage("ja-JP");
            await renderAt(c);
            expect(document.head.querySelector('link[rel="alternate"]')).toBeNull();
            expect(href('link[rel="canonical"]')).toBe(pageUrl(c.path));
            // the shell may still be in Japanese here, so <html lang> stays the app's (set
            // to "en" before the render by beforeEach), not forced by the page
            expect(document.documentElement.lang).toBe("en");
        });
    }
});

describe("audience pages and blog articles", () => {
    it.each(["research", "teams", "projects", "students"])("/for-%s", async (key) => {
        const SegmentPage = (await import("../lp/SegmentLandingPage")).default as ComponentType<{
            segment: string;
        }>;
        const path = `/for-${key}`;
        window.history.replaceState({}, "", path);
        setLanguage("ja-JP");
        render(
            <MemoryRouter initialEntries={[path]}>
                <SegmentPage segment={key} />
            </MemoryRouter>
        );
        expect(document.title).toMatch(/Genos/);
        expect(href('link[rel="canonical"]')).toBe(pageUrl(path, "ja"));
        expect(document.documentElement.lang).toBe("ja");
    });

    it("every blog article is an English article page with its own title and date", async () => {
        const BlogArticlePage = (await import("../lp/BlogArticlePage")).default;
        for (const meta of articlesManifest) {
            document.head.innerHTML = "<title>Genos</title>";
            const path = `/blog/${meta.slug}`;
            window.history.replaceState({}, "", path);
            const { unmount } = render(
                <MemoryRouter initialEntries={[path]}>
                    <Routes>
                        <Route element={<BlogArticlePage />} path="/blog/:slug" />
                    </Routes>
                </MemoryRouter>
            );
            expect(document.title, meta.slug).toBe(`${meta.title} | Genos`);
            expect(content('meta[name="description"]'), meta.slug).toBe(meta.excerpt);
            expect(content('meta[property="og:type"]')).toBe("article");
            expect(content('meta[property="article:published_time"]')).toBe(meta.publishedAt);
            expect(href('link[rel="canonical"]')).toBe(`${SITE_ORIGIN}${path}`);
            expect(document.head.querySelector('link[rel="alternate"]')).toBeNull();
            unmount();
        }
    });
});
