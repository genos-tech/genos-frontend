import { APP_URL } from "../kit/links";

/**
 * The public marketing routes, in one place: what the sitemap lists, which of
 * them have a Japanese and an English version, and what `useDocumentMeta` may
 * claim about each (canonical, hreflang).
 *
 * Deliberately a plain module with no React and no copy imports: the sitemap
 * plugin (scripts/lpSeo.ts) runs in the build's Node process, and a route added
 * to `main.tsx` without being added here fails `lpSeoRoutes.test.ts`, so the
 * sitemap cannot quietly fall behind the router.
 */

/** The origin every canonical, hreflang, og:url and sitemap entry is built on. */
export const SITE_ORIGIN = APP_URL;

/** Share card, 1200x630, in `public/`. Regenerate with `npm run seo:share-image`. */
export const SHARE_IMAGE_PATH = "/genos-share.png";
export const SHARE_IMAGE_SIZE = { width: 1200, height: 630 } as const;

/**
 * How a page relates to the ja/en toggle:
 *  - `toggle`: the whole page switches language, so it has two versions
 *    (`/path` for English, `/path?lang=ja` for Japanese) that point at each
 *    other with hreflang.
 *  - `en-only`: written in English only (developer reference, blog).
 *  - `bilingual`: one URL that carries both languages at once (the legal
 *    pages: Japanese is the operative text, English a summary). No alternates.
 */
export type LangMode = "toggle" | "en-only" | "bilingual";

export interface LpRoute {
    path: string;
    langs: LangMode;
}

/** Every public, indexable page that is a fixed path. `/blog/:slug` is added from the manifest. */
export const LP_ROUTES: readonly LpRoute[] = [
    { path: "/home", langs: "toggle" },
    { path: "/for-research", langs: "toggle" },
    { path: "/for-teams", langs: "toggle" },
    { path: "/for-projects", langs: "toggle" },
    { path: "/for-students", langs: "toggle" },
    { path: "/features-guide", langs: "toggle" },
    { path: "/demo-guide", langs: "toggle" },
    { path: "/plans", langs: "toggle" },
    { path: "/blog", langs: "en-only" },
    { path: "/developers", langs: "en-only" },
    { path: "/support", langs: "toggle" },
    { path: "/privacy", langs: "bilingual" },
    { path: "/legal", langs: "bilingual" },
];

const BLOG_ARTICLE = /^\/blog\/[^/]+$/;

/** The route a path belongs to; a blog article is an English-only page. */
export const routeFor = (path: string): LpRoute | undefined => {
    const clean = path.length > 1 ? path.replace(/\/+$/, "") : path;
    // React Router matches case-insensitively, so `/Plans` is the plans page.
    const fixed = LP_ROUTES.find((r) => r.path === clean.toLowerCase());
    if (fixed) return fixed;
    if (BLOG_ARTICLE.test(clean.toLowerCase())) return { path: clean, langs: "en-only" };
    return undefined;
};

/**
 * Paths a crawler should not spend time on: the signed-in app and the auth
 * handoffs. `/` is not listed: it is the sign-in entry and redirects there.
 * (robots.txt in `public/` mirrors this list; `lpSeoRoutes.test.ts` checks it.)
 */
export const ROBOTS_DISALLOW: readonly string[] = [
    "/workspace/",
    "/signin",
    "/signup",
    "/reset-password",
    "/oauth/",
    "/verify-email",
    "/accept-invite",
    "/jointeam",
];
