/**
 * The stable names of the marketing buttons the funnel reports (`data-cta`, MIP-1778; the scheme
 * is `<page>_<position>_<action>` from note 178 of MIP-1266). A name is what the saved PostHog
 * funnel keys on, so renaming one silently breaks the weekly view: this pins them.
 */
import { render } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { listBlogArticles } from "../lp/blog/blog";
import BlogArticlePage from "../lp/BlogArticlePage";
import DemoPage from "../lp/DemoPage";
import FeaturesPage from "../lp/FeaturesPage";
import LandingPage from "../lp/LandingPage";
import PlansPage from "../lp/PlansPage";
import SegmentLandingPage from "../lp/SegmentLandingPage";

vi.mock("../services/billingApi", async (importOriginal) => ({
    ...(await importOriginal<typeof import("../services/billingApi")>()),
    fetchPublicBillingPlans: vi.fn().mockResolvedValue({
        billing_enabled: true,
        tiers: [
            { tier: "free", price: null, purchasable: true, contact_sales: false, limits: {} },
            { tier: "pro", price: null, purchasable: true, contact_sales: false, limits: {} },
        ],
    }),
}));

beforeEach(() => {
    localStorage.clear();
});

const ctas = (container: HTMLElement): string[] =>
    Array.from(container.querySelectorAll("[data-cta]")).map(
        (el) => el.getAttribute("data-cta") as string
    );

const renderAt = (path: string, element: React.ReactElement, route = path) =>
    render(
        <MemoryRouter initialEntries={[path]}>
            <Routes>
                <Route element={element} path={route} />
            </Routes>
        </MemoryRouter>
    );

describe("data-cta names", () => {
    it("home", () => {
        const { container } = renderAt("/home", <LandingPage />);
        expect(ctas(container)).toEqual(
            expect.arrayContaining([
                "nav_sign_in",
                "nav_try_demo",
                "hero_connect",
                "hero_try_demo",
                "closing_try_demo",
                "closing_signup",
                "footer_signup",
            ])
        );
    });

    it("features and demo guide", () => {
        expect(ctas(renderAt("/features-guide", <FeaturesPage />).container)).toEqual(
            expect.arrayContaining(["features_hero_try_demo", "features_closing_try_demo"])
        );
        expect(ctas(renderAt("/demo-guide", <DemoPage />).container)).toEqual(
            expect.arrayContaining(["demo_hero_try_demo", "demo_closing_try_demo"])
        );
    });

    it.each(["research", "teams", "projects", "students"] as const)(
        "the %s segment page",
        (segment) => {
            const { container } = renderAt(
                `/for-${segment}`,
                <SegmentLandingPage segment={segment} />
            );
            expect(ctas(container)).toEqual(
                expect.arrayContaining([
                    `segment_${segment}_hero_try_demo`,
                    `segment_${segment}_closing_try_demo`,
                ])
            );
        }
    );

    it("plans: every purchasable card, a router link into /signup", async () => {
        const { container } = renderAt("/plans", <PlansPage />);
        await vi.waitFor(() => expect(ctas(container)).toContain("plans_signup"));
        const link = container.querySelector("a[data-cta='plans_signup']");
        expect(link?.getAttribute("href")).toBe("/signup");
    });

    it("a blog article", () => {
        const slug = listBlogArticles()[0].slug;
        const { container } = renderAt(`/blog/${slug}`, <BlogArticlePage />, "/blog/:slug");
        expect(ctas(container)).toContain("blog_article_try_demo");
    });

    it("the menu on a narrow screen names its own buttons", () => {
        const { container } = renderAt("/home", <LandingPage />);
        (container.querySelector("button[aria-controls='lp-menu']") as HTMLElement).click();
        // The menu opens through state; read after the click's re-render.
        return vi.waitFor(() =>
            expect(ctas(container)).toEqual(
                expect.arrayContaining(["menu_try_demo", "menu_sign_in"])
            )
        );
    });

    it("every name follows the scheme (lowercase words and underscores)", () => {
        const { container } = renderAt("/home", <LandingPage />);
        for (const name of ctas(container)) expect(name).toMatch(/^[a-z0-9_]{1,60}$/);
    });
});
