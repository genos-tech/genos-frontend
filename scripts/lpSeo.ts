import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { Plugin } from "vite";

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
const readArticles = (root: string): SitemapArticle[] => {
    const manifest = JSON.parse(
        readFileSync(join(root, "src/lp/blog/articles.json"), "utf8")
    ) as Array<{ slug: string; publishedAt: string; language: string }>;
    return manifest
        .filter((a) => a.language === "en")
        .map((a) => ({ slug: a.slug, publishedAt: a.publishedAt }));
};

export const lpSeo = (): Plugin => {
    let root = process.cwd();
    return {
        name: "lp-seo",
        apply: "build",
        configResolved(config) {
            root = config.root;
        },
        generateBundle() {
            this.emitFile({
                type: "asset",
                fileName: "sitemap.xml",
                source: buildSitemapXml(readArticles(root)),
            });
        },
    };
};
