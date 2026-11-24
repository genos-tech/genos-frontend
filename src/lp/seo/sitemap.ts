import { pageUrl } from "./head";
import { LP_ROUTES, SITE_ORIGIN, type LpRoute } from "./routes";

export interface SitemapArticle {
    slug: string;
    /** `YYYY-MM-DD`. */
    publishedAt: string;
}

const escapeXml = (s: string): string =>
    s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/**
 * sitemap.xml for every public page. A page with a Japanese and an English
 * version lists BOTH as their own `<url>`, each carrying the full alternate
 * set (Google's rule: every version names all versions, itself included).
 * `lastmod` appears only where a real date exists (blog articles); a made-up
 * "today" on every build would teach crawlers to ignore it.
 */
export const buildSitemapXml = (
    articles: readonly SitemapArticle[],
    manualPaths: readonly string[] = []
): string => {
    const entries: string[] = [];
    const url = (loc: string, extra: string[] = [], lastmod?: string) => {
        const lines = [`    <loc>${escapeXml(loc)}</loc>`];
        if (lastmod) lines.push(`    <lastmod>${escapeXml(lastmod)}</lastmod>`);
        lines.push(...extra);
        entries.push(`  <url>\n${lines.join("\n")}\n  </url>`);
    };
    const link = (hreflang: string, href: string) =>
        `    <xhtml:link rel="alternate" hreflang="${hreflang}" href="${escapeXml(href)}"/>`;

    // The manual's topic pages (`/docs/<topic>`) toggle between Japanese and English like /docs.
    const routes = [
        ...LP_ROUTES,
        ...manualPaths.map((path): LpRoute => ({ path, langs: "toggle" })),
    ];
    for (const route of routes) {
        // An alias (`/home`) is not a page of its own: its canonical (`/`) is listed instead.
        if (route.canonicalPath) continue;
        if (route.langs === "toggle") {
            const alternates = [
                link("en", pageUrl(route.path, "en")),
                link("ja", pageUrl(route.path, "ja")),
                link("x-default", pageUrl(route.path)),
            ];
            url(pageUrl(route.path, "en"), alternates);
            url(pageUrl(route.path, "ja"), alternates);
        } else {
            url(`${SITE_ORIGIN}${route.path}`);
        }
    }
    for (const a of articles) {
        url(`${SITE_ORIGIN}/blog/${a.slug}`, [], a.publishedAt);
    }

    return (
        `<?xml version="1.0" encoding="UTF-8"?>\n` +
        `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" ` +
        `xmlns:xhtml="http://www.w3.org/1999/xhtml">\n${entries.join("\n")}\n</urlset>\n`
    );
};
