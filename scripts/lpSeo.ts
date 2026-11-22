import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

import type { ChangelogEntry } from "../src/lp/changelog/changelog";
import { buildChangelogRss } from "../src/lp/changelog/rss";
import { buildSeoPages, type BlogArticleHead } from "../src/lp/seo/pageHeads";
import { buildSitemapXml, type SitemapArticle } from "../src/lp/seo/sitemap";

// Emits `sitemap.xml` into the build output from the same route list the app
// uses (src/lp/seo/routes.ts) plus the blog manifest, so a new route or article
// is in the sitemap without anyone remembering to add it.
//
// Build-only, and it only ADDS one asset: it cannot change index.html, the
// bundle or serve.json, so it cannot break the deploy the way a change to how
// the site is served could. (A failure to read the manifest throws, on
// purpose: a build without a sitemap should be red, not silently shipped.)
//
// The manifest is read from disk rather than imported because the Node-side
// tsconfig has no JSON-module support.
const readManifest = (root: string): BlogArticleHead[] =>
    JSON.parse(readFileSync(join(root, "src/lp/blog/articles.json"), "utf8")) as BlogArticleHead[];

const readArticles = (root: string): SitemapArticle[] => {
    const manifest = JSON.parse(
        readFileSync(join(root, "src/lp/blog/articles.json"), "utf8")
    ) as Array<{ slug: string; publishedAt: string; language: string }>;
    return manifest
        .filter((a) => a.language === "en")
        .map((a) => ({ slug: a.slug, publishedAt: a.publishedAt }));
};

// The changelog entries, read from disk for the same reason as the manifest above.
const readChangelog = (root: string): ChangelogEntry[] =>
    JSON.parse(
        readFileSync(join(root, "src/lp/changelog/entries.json"), "utf8")
    ) as ChangelogEntry[];

export const lpSeo = (): Plugin => {
    let root = process.cwd();
    return {
        name: "lp-seo",
        apply: "build",
        // After Vite's own HTML plugin, so `bundle["index.html"]` is the final file.
        enforce: "post",
        configResolved(config) {
            root = config.root;
        },
        generateBundle(_options, bundle) {
            this.emitFile({
                type: "asset",
                fileName: "sitemap.xml",
                source: buildSitemapXml(readArticles(root)),
            });
            // changelog.rss from the same entries the /changelog page shows (MIP-1257).
            this.emitFile({
                type: "asset",
                fileName: "changelog.rss",
                source: buildChangelogRss(readChangelog(root)),
            });

            // One copy of index.html per public page and language with that page's head
            // written in (MIP-1988): a crawler or link preview that does not run JavaScript
            // gets the page's own title, description, canonical, hreflang and share card.
            // `scripts/serve-spa.mjs` picks the file by path and `?lang=`; the manifest
            // is the list of what exists. The bundle itself is untouched.
            const index = bundle["index.html"];
            if (!index || index.type !== "asset") {
                throw new Error("lp-seo: no index.html in the bundle to write page heads from");
            }
            const template = String(index.source);
            const pages = buildSeoPages(template, readManifest(root));
            for (const page of pages) {
                this.emitFile({ type: "asset", fileName: page.file, source: page.html });
            }
            const entries = pages.map(({ path, lang, file }) => ({ path, lang, file }));
            this.emitFile({
                type: "asset",
                fileName: "_seo/manifest.json",
                source: JSON.stringify(entries, null, 2),
            });
        },
    };
};
