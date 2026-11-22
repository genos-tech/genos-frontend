/**
 * What a crawler that does NOT run JavaScript receives (MIP-1988): for every URL
 * in sitemap.xml, the HTML the server returns carries that page's own title,
 * description, canonical, hreflang, `<html lang>` and share card.
 *
 * Builds the `_seo/**` files with the same function the Vite plugin uses (on the
 * repo's real index.html), serves them with the real server (scripts/serve-spa.mjs)
 * on a free port, and fetches every sitemap URL. No Vite build needed, so it is fast.
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import type { Server } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { createSpaServer, pickPage, routeKey } from "../../scripts/serve-spa.mjs";
import articlesManifest from "../lp/blog/articles.json";
import { buildHeadTags } from "../lp/seo/head";
import { PRERENDER_ATTR } from "../lp/seo/injectHead";
import { buildSeoPages, headSpecFor } from "../lp/seo/pageHeads";
import { LP_ROUTES, SITE_ORIGIN } from "../lp/seo/routes";
import { buildSitemapXml } from "../lp/seo/sitemap";

const root = resolve(__dirname, "../..");
const template = readFileSync(join(root, "index.html"), "utf8");
const articles = articlesManifest as Parameters<typeof buildSeoPages>[1];
const sitemapArticles = articles
    .filter((a) => a.language === "en")
    .map((a) => ({ slug: a.slug, publishedAt: a.publishedAt }));

/** Pages that have no meta of their own yet: they keep index.html's generic head. Listed so a new gap fails here. */
const NO_OWN_META = ["/terms"];

const sitemapUrls = [...buildSitemapXml(sitemapArticles).matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    (m) => m[1].replace(/&amp;/g, "&")
);

let dist: string;
let server: Server;
let base: string;

beforeAll(async () => {
    dist = mkdtempSync(join(tmpdir(), "genos-seo-"));
    writeFileSync(join(dist, "index.html"), template);
    writeFileSync(join(dist, "robots.txt"), "User-agent: *\n");
    mkdirSync(join(dist, "assets"));
    writeFileSync(join(dist, "assets", "app-abc.js"), "console.log(1);\n".repeat(200));
    writeFileSync(
        join(dist, "serve.json"),
        JSON.stringify({
            headers: [
                { source: "**", headers: [{ key: "Cache-Control", value: "no-cache" }] },
                {
                    source: "assets/**",
                    headers: [
                        { key: "Cache-Control", value: "public, max-age=31536000, immutable" },
                    ],
                },
            ],
        })
    );
    const pages = buildSeoPages(template, articles);
    for (const p of pages) {
        mkdirSync(dirname(join(dist, p.file)), { recursive: true });
        writeFileSync(join(dist, p.file), p.html);
    }
    writeFileSync(
        join(dist, "_seo", "manifest.json"),
        JSON.stringify(pages.map(({ path, lang, file }) => ({ path, lang, file })))
    );
    server = createSpaServer(dist);
    await new Promise<void>((ok) => server.listen(0, "127.0.0.1", ok));
    base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
});

afterAll(() => {
    server.close();
    rmSync(dist, { recursive: true, force: true });
});

const parse = (html: string) => new DOMParser().parseFromString(html, "text/html");
const attr = (doc: Document, selector: string, name: string) =>
    doc.head.querySelector(selector)?.getAttribute(name) ?? null;

describe("every sitemap URL is served with its own head", () => {
    it("lists the URLs it should", () => {
        // 13 toggle routes x2 + the rest, minus the /home alias, plus the articles
        expect(sitemapUrls.length).toBeGreaterThan(40);
    });

    for (const url of sitemapUrls) {
        const u = new URL(url);
        const lang = u.searchParams.get("lang") === "ja" ? "ja" : "en";
        const target = u.pathname + u.search;

        it(`${target}`, async () => {
            const res = await fetch(base + target);
            expect(res.status).toBe(200);
            expect(res.headers.get("content-type")).toContain("text/html");
            const doc = parse(await res.text());
            const spec = headSpecFor(u.pathname, lang, articles);
            if (!spec) {
                expect(NO_OWN_META).toContain(u.pathname);
                return;
            }
            // title, description, share card: exactly what the page sets after mount
            expect(doc.title).toBe(spec.title);
            const tags = buildHeadTags(spec);
            for (const tag of tags) {
                if (tag.kind === "meta") {
                    expect(attr(doc, `meta[${tag.attr}="${tag.key}"]`, "content")).toBe(
                        tag.content
                    );
                } else if (tag.rel === "canonical") {
                    expect(attr(doc, 'link[rel="canonical"]', "href")).toBe(tag.href);
                } else {
                    expect(
                        attr(doc, `link[rel="alternate"][hreflang="${tag.hreflang}"]`, "href")
                    ).toBe(tag.href);
                }
            }
            // exactly one of each, never a leftover generic tag next to the page's own
            expect(doc.head.querySelectorAll('link[rel="canonical"]')).toHaveLength(1);
            expect(doc.head.querySelectorAll("title")).toHaveLength(1);
            expect(doc.head.querySelectorAll('meta[name="description"]')).toHaveLength(1);
            expect(doc.head.querySelectorAll('meta[property="og:title"]')).toHaveLength(1);
            expect(doc.head.querySelectorAll('meta[property="og:url"]')).toHaveLength(1);
            expect(doc.head.querySelectorAll('meta[name="twitter:title"]')).toHaveLength(1);
            expect(attr(doc, 'meta[property="og:image"]', "content")).toBe(
                `${SITE_ORIGIN}/genos-share.png`
            );
            // the canonical is the sitemap URL itself, except for aliases and ?lang=ja on a page with no ja version
            expect(attr(doc, 'link[rel="canonical"]', "href")).toBe(url);
            // hreflang set (en, ja, x-default) wherever the page has two languages
            const toggles = LP_ROUTES.find((r) => r.path === u.pathname)?.langs === "toggle";
            expect(doc.head.querySelectorAll('link[rel="alternate"][hreflang]')).toHaveLength(
                toggles ? 3 : 0
            );
            // <html lang>: ja only on the Japanese version of a toggling page
            expect(doc.documentElement.lang).toBe(toggles && lang === "ja" ? "ja" : "en");
            // everything else from index.html survives
            expect(doc.querySelector('script[type="application/ld+json"]')).not.toBeNull();
            expect(doc.querySelector('script[type="module"]')).not.toBeNull();
            expect(doc.getElementById("root")).not.toBeNull();
        });
    }
});

describe("pages without their own meta", () => {
    it("are exactly the ones listed (add a title and description, then remove the line)", () => {
        const without = [
            ...LP_ROUTES.map((r) => r.path).filter((p) => !headSpecFor(p, "en", articles)),
        ];
        expect(without.sort()).toEqual([...NO_OWN_META].sort());
    });
});

describe("serve-spa", () => {
    const get = (path: string, init?: RequestInit) => fetch(base + path, init);

    it("picks the Japanese file only where the page has one, whatever else is in the query", async () => {
        const ja = await (await get("/plans?utm=x&lang=ja")).text();
        expect(parse(ja).documentElement.lang).toBe("ja");
        const en = await (await get("/blog?lang=ja")).text();
        expect(parse(en).documentElement.lang).toBe("en");
        expect(attr(parse(en), 'link[rel="canonical"]', "href")).toBe(`${SITE_ORIGIN}/blog`);
    });

    it("matches the router: case, trailing slash, the /home alias", async () => {
        for (const p of ["/Plans", "/plans/", "/PLANS/"]) {
            const doc = parse(await (await get(p)).text());
            expect(attr(doc, 'link[rel="canonical"]', "href")).toBe(`${SITE_ORIGIN}/plans`);
        }
        const home = parse(await (await get("/home")).text());
        expect(attr(home, 'link[rel="canonical"]', "href")).toBe(`${SITE_ORIGIN}/`);
        const root = parse(await (await get("/")).text());
        expect(attr(root, 'link[rel="canonical"]', "href")).toBe(`${SITE_ORIGIN}/`);
    });

    it("keeps the SPA: app and unknown routes get the plain index.html with 200", async () => {
        for (const p of [
            "/workspace/chat/1",
            "/signin",
            "/no-such-page",
            "/blog/no-such-article",
        ]) {
            const res = await get(p);
            expect(res.status).toBe(200);
            const text = await res.text();
            expect(text).toBe(template);
            expect(text).not.toContain(PRERENDER_ATTR);
        }
    });

    it("serves real files, with serve.json headers, 404 for a missing asset, never the _seo copies", async () => {
        const robots = await get("/robots.txt");
        expect(robots.status).toBe(200);
        expect(robots.headers.get("cache-control")).toBe("no-cache");
        const asset = await get("/assets/app-abc.js", { headers: { "accept-encoding": "gzip" } });
        expect(asset.headers.get("cache-control")).toBe("public, max-age=31536000, immutable");
        expect(asset.headers.get("content-type")).toContain("javascript");
        expect((await get("/assets/missing.js")).status).toBe(404);
        expect((await get("/_seo/en/plans.html")).status).toBe(404);
        expect((await get("/_seo/manifest.json")).status).toBe(404);
    });

    it("answers a conditional request with 304 and HEAD without a body", async () => {
        const first = await get("/plans");
        const etag = first.headers.get("etag");
        expect(etag).toBeTruthy();
        expect((await get("/plans", { headers: { "if-none-match": etag! } })).status).toBe(304);
        const head = await get("/plans", { method: "HEAD" });
        expect(head.status).toBe(200);
        expect(await head.text()).toBe("");
        expect((await get("/plans", { method: "POST" })).status).toBe(405);
    });

    it("refuses path traversal and bad escapes", async () => {
        const res = await get("/%2e%2e/%2e%2e/etc/passwd");
        expect(res.status).toBe(200); // the SPA shell, never a file outside dist
        expect(await res.text()).toBe(template);
        expect((await get("/%E0%A4%A")).status).toBe(400);
    });

    it("routeKey and pickPage are pure", () => {
        expect(routeKey("/Plans/")).toBe("/plans");
        expect(routeKey("/")).toBe("/");
        expect(routeKey("/%zz")).toBeNull();
        expect(pickPage(new Map(), "/plans", "?lang=ja")).toBeNull();
    });
});
