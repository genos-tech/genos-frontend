/**
 * The files crawlers read: sitemap.xml, robots.txt, the static head in
 * index.html, and the share image. Each is checked against the one route list
 * (src/lp/seo/routes.ts) and against the router itself, so a public page added
 * to main.tsx without a sitemap entry, or an auth route left crawlable, fails
 * here instead of shipping quietly.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import articlesManifest from "../lp/blog/articles.json";
import { buildHeadTags, pageUrl } from "../lp/seo/head";
import { LP_ROUTES, ROBOTS_DISALLOW, routeFor, SITE_ORIGIN } from "../lp/seo/routes";
import { buildSitemapXml } from "../lp/seo/sitemap";

const root = resolve(__dirname, "../..");
const read = (rel: string) => readFileSync(resolve(root, rel), "utf8");

/** Paths of the routes main.tsx registers as public marketing pages. */
const publicPathsInRouter = (): string[] => {
    const src = read("src/main.tsx");
    const re =
        /element=\{publicPage\(\w+\)\}\s+path="([^"]+)"|element=\{publicSegmentPage\("\w+"\)\}\s+path="([^"]+)"/g;
    const out: string[] = [];
    for (const m of src.matchAll(re)) out.push(m[1] ?? m[2]);
    return out;
};

const articles = articlesManifest
    .filter((a) => a.language === "en")
    .map((a) => ({ slug: a.slug, publishedAt: a.publishedAt }));

describe("route list", () => {
    it("is exactly the public pages main.tsx registers outside the auth stack", () => {
        const inRouter = publicPathsInRouter()
            .filter((p) => !p.includes(":"))
            .sort();
        expect(inRouter.length).toBeGreaterThan(8);
        expect(LP_ROUTES.map((r) => r.path).sort()).toEqual(inRouter);
        // the one parameterised public route is the blog article
        expect(publicPathsInRouter()).toContain("/blog/:slug");
    });

    it("treats any blog article as an English-only page", () => {
        expect(routeFor("/blog/anything")?.langs).toBe("en-only");
        expect(routeFor("/blog/")?.path).toBe("/blog");
        expect(routeFor("/workspace/tasks")).toBeUndefined();
    });
});

describe("sitemap.xml", () => {
    const xml = buildSitemapXml(articles);
    const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

    it("lists every public page and every article, once, on the real origin", () => {
        const expected = [
            ...LP_ROUTES.flatMap((r) =>
                r.langs === "toggle"
                    ? [pageUrl(r.path, "en"), pageUrl(r.path, "ja")]
                    : [`${SITE_ORIGIN}${r.path}`]
            ),
            ...articles.map((a) => `${SITE_ORIGIN}/blog/${a.slug}`),
        ];
        expect(locs.sort()).toEqual(expected.sort());
        expect(new Set(locs).size).toBe(locs.length);
        expect(articles.length).toBeGreaterThan(0);
    });

    it("lists no auth, app or demo-sign-in route", () => {
        for (const loc of locs) {
            const path = new URL(loc).pathname;
            for (const blocked of ROBOTS_DISALLOW) {
                expect(path.startsWith(blocked.replace(/\/$/, "")), loc).toBe(false);
            }
        }
        expect(locs).not.toContain(`${SITE_ORIGIN}/`);
    });

    it("gives each Japanese/English page the full alternate set, itself included", () => {
        const blocks = xml.split("<url>").slice(1);
        const toggle = LP_ROUTES.filter((r) => r.langs === "toggle");
        for (const r of toggle) {
            const pair = blocks.filter(
                (b) =>
                    b.includes(`<loc>${pageUrl(r.path, "en")}</loc>`) ||
                    b.includes(`<loc>${pageUrl(r.path, "ja")}</loc>`)
            );
            expect(pair, r.path).toHaveLength(2);
            for (const b of pair) {
                expect(b).toContain(`hreflang="en" href="${pageUrl(r.path, "en")}"`);
                expect(b).toContain(`hreflang="ja" href="${pageUrl(r.path, "ja")}"`);
                expect(b).toContain(`hreflang="x-default" href="${pageUrl(r.path)}"`);
            }
        }
        // English-only and bilingual pages claim no alternates
        const devs = blocks.find((b) => b.includes(`<loc>${SITE_ORIGIN}/developers</loc>`));
        expect(devs).toBeDefined();
        expect(devs).not.toContain("xhtml:link");
    });

    it("takes lastmod only from a real date", () => {
        expect(xml).toContain(`<lastmod>${articles[0].publishedAt}</lastmod>`);
        expect([...xml.matchAll(/<lastmod>/g)].length).toBe(articles.length);
    });

    it("is well-formed XML", () => {
        const doc = new DOMParser().parseFromString(xml, "application/xml");
        expect(doc.getElementsByTagName("parsererror")).toHaveLength(0);
        expect(doc.getElementsByTagName("url").length).toBe(locs.length);
    });
});

describe("robots.txt", () => {
    const robots = read("public/robots.txt");
    const lines = robots.split("\n").map((l) => l.trim());

    it("disallows exactly the signed-in app and auth handoffs, and nothing public", () => {
        const disallowed = lines
            .filter((l) => l.startsWith("Disallow:"))
            .map((l) => l.slice(9).trim());
        expect(disallowed.sort()).toEqual([...ROBOTS_DISALLOW].sort());
        for (const r of LP_ROUTES) {
            for (const d of disallowed)
                expect(r.path.startsWith(d), `${r.path} vs ${d}`).toBe(false);
        }
    });

    it("applies to everyone and names the sitemap", () => {
        expect(lines).toContain("User-agent: *");
        expect(lines).toContain(`Sitemap: ${SITE_ORIGIN}/sitemap.xml`);
        expect(lines.filter((l) => l === "Disallow: /")).toHaveLength(0);
    });
});

describe("share image", () => {
    it("is a real 1200x630 PNG in public/", () => {
        const png = readFileSync(resolve(root, "public/genos-share.png"));
        expect(png.subarray(1, 4).toString("ascii")).toBe("PNG");
        expect(png.readUInt32BE(16)).toBe(1200);
        expect(png.readUInt32BE(20)).toBe(630);
    });

    it("is the og:image and twitter:image of every page, as an absolute URL", () => {
        const tags = buildHeadTags({
            title: "t",
            description: "d",
            ogTitle: "t",
            ogDescription: "d",
            path: "/plans",
        });
        const image = tags.find((t) => t.kind === "meta" && t.key === "og:image");
        expect(image && image.kind === "meta" && image.content).toBe(
            `${SITE_ORIGIN}/genos-share.png`
        );
        const tw = tags.find((t) => t.kind === "meta" && t.key === "twitter:image");
        expect(tw && tw.kind === "meta" && tw.content).toBe(`${SITE_ORIGIN}/genos-share.png`);
    });
});

describe("index.html (what a crawler without JavaScript receives)", () => {
    const html = read("index.html");

    it("carries the name and share image, and no per-page claim", () => {
        expect(html).toContain(`property="og:image" content="${SITE_ORIGIN}/genos-share.png"`);
        expect(html).toContain('name="twitter:card" content="summary_large_image"');
        // Wrong on every route but one, so never static:
        expect(html).not.toMatch(/rel="canonical"/);
        expect(html).not.toMatch(/property="og:url"/);
        expect(html).not.toMatch(/name="description"/);
        expect(html).not.toMatch(/og:description/);
    });

    it("has JSON-LD with only verifiable facts: Organization and SoftwareApplication", () => {
        const m = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
        expect(m).not.toBeNull();
        const data = JSON.parse(m![1]);
        const graph = data["@graph"] as Array<Record<string, unknown>>;
        expect(graph.map((n) => n["@type"]).sort()).toEqual([
            "Organization",
            "SoftwareApplication",
        ]);
        for (const node of graph) {
            expect(node.name).toBe("Genos");
            expect(node.url).toBe(SITE_ORIGIN);
        }
        const org = graph.find((n) => n["@type"] === "Organization")!;
        expect(org.logo).toBe(`${SITE_ORIGIN}/genos-logo.png`);
        // No claims a reader could not check on the site.
        const text = JSON.stringify(data);
        for (const forbidden of [
            "aggregateRating",
            "review",
            "offers",
            "price",
            "award",
            "sameAs",
        ]) {
            expect(text, forbidden).not.toContain(forbidden);
        }
    });
});
