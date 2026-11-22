// Static server for the built SPA (dist/), replacing `serve -s dist` (MIP-1988).
//
// Why not `serve`: it answers every unknown path with the one index.html and
// cannot look at the query string, so every public page shipped the same generic
// head and `?lang=ja` could never get a Japanese one. This server does what
// `serve -s` did, with one difference: for a public marketing route it answers
// with the copy of index.html that scripts/lpSeo.ts wrote for that page and
// language (dist/_seo/**, listed in dist/_seo/manifest.json), so a crawler or
// link preview that does not run JavaScript sees the page's own title,
// description, canonical, hreflang and share card.
//
// What is kept from `serve -s`: unknown paths get index.html with 200 (the SPA
// router decides), headers come from dist/serve.json (security headers, CSP,
// Cache-Control), gzip for text, ETag + 304. What changes: a missing file under
// /assets/ is a 404 (serve returned HTML there), and /_seo/* is never served.
// Node built-ins only. If the manifest is missing every route gets index.html,
// which is exactly the old behaviour.
//
// Usage: node scripts/serve-spa.mjs [distDir]   (listens on $PORT, default 3000)

import { createHash } from "node:crypto";
import { existsSync, readFileSync, statSync } from "node:fs";
import { createServer } from "node:http";
import { extname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { gzip } from "node:zlib";

const TYPES = {
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".json": "application/json; charset=utf-8",
    ".map": "application/json; charset=utf-8",
    ".webmanifest": "application/manifest+json; charset=utf-8",
    ".xml": "application/xml; charset=utf-8",
    ".rss": "application/rss+xml; charset=utf-8",
    ".txt": "text/plain; charset=utf-8",
    ".svg": "image/svg+xml",
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
    ".ico": "image/x-icon",
    ".woff": "font/woff",
    ".woff2": "font/woff2",
    ".ttf": "font/ttf",
    ".wasm": "application/wasm",
};
const COMPRESSIBLE = /^(text\/|application\/(json|xml|manifest\+json|rss\+xml)|image\/svg)/;

/** Header rules from serve.json. Only the two patterns the build writes are understood; anything else fails loudly. */
const loadHeaderRules = (dist) => {
    const file = join(dist, "serve.json");
    if (!existsSync(file)) return [];
    const rules = [];
    for (const rule of JSON.parse(readFileSync(file, "utf8")).headers ?? []) {
        if (rule.source !== "**" && rule.source !== "assets/**") {
            throw new Error(`serve-spa: unsupported serve.json header source "${rule.source}"`);
        }
        rules.push({
            prefix: rule.source === "**" ? "" : "/assets/",
            headers: rule.headers.map((h) => [h.key, h.value]),
        });
    }
    return rules;
};

const loadManifest = (dist) => {
    const file = join(dist, "_seo", "manifest.json");
    if (!existsSync(file)) return new Map();
    const map = new Map();
    for (const e of JSON.parse(readFileSync(file, "utf8"))) {
        map.set(`${e.lang}:${e.path}`, readFileSync(join(dist, e.file)));
    }
    return map;
};

/**
 * The route key a request path belongs to: decoded, lower-cased (the router matches
 * case-insensitively), no trailing slash. Returns null for a path that is not valid.
 */
export const routeKey = (pathname) => {
    let p;
    try {
        p = decodeURIComponent(pathname);
    } catch {
        return null;
    }
    if (p.includes("\0")) return null;
    p = p.toLowerCase();
    return p.length > 1 ? p.replace(/\/+$/, "") : p;
};

/** Which prerendered page answers (path, query), or null for plain index.html. */
export const pickPage = (pages, pathname, search) => {
    const key = routeKey(pathname);
    if (key === null) return null;
    const wantJa = new URLSearchParams(search).get("lang") === "ja";
    // `lang=ja` only has its own file on pages that toggle; elsewhere the English file is right.
    return (wantJa && pages.get(`ja:${key}`)) || pages.get(`en:${key}`) || null;
};

export const createSpaServer = (distDir) => {
    const dist = resolve(distDir);
    const rules = loadHeaderRules(dist);
    const pages = loadManifest(dist);
    const indexHtml = readFileSync(join(dist, "index.html"));
    const gzCache = new Map();

    const etagOf = (buf) => `"${createHash("sha1").update(buf).digest("base64url").slice(0, 27)}"`;

    const send = (req, res, status, body, type, extra = {}, etag) => {
        const url = new URL(req.url, "http://x");
        for (const rule of rules) {
            if (url.pathname.startsWith(rule.prefix) || rule.prefix === "") {
                for (const [k, v] of rule.headers) res.setHeader(k, v);
            }
        }
        for (const [k, v] of Object.entries(extra)) res.setHeader(k, v);
        res.setHeader("Content-Type", type);
        res.setHeader("Vary", "Accept-Encoding");
        if (etag) {
            res.setHeader("ETag", etag);
            if (req.headers["if-none-match"] === etag) {
                res.statusCode = 304;
                return res.end();
            }
        }
        const wantsGzip = /\bgzip\b/.test(String(req.headers["accept-encoding"] ?? ""));
        const finish = (buf, encoded) => {
            if (encoded) res.setHeader("Content-Encoding", "gzip");
            res.setHeader("Content-Length", buf.length);
            res.statusCode = status;
            res.end(req.method === "HEAD" ? undefined : buf);
        };
        if (wantsGzip && COMPRESSIBLE.test(type) && body.length > 1024) {
            const cacheKey = etag ?? null;
            const hit = cacheKey && gzCache.get(cacheKey);
            if (hit) return finish(hit, true);
            return gzip(body, (err, zipped) => {
                if (err) return finish(body, false);
                if (cacheKey) gzCache.set(cacheKey, zipped);
                finish(zipped, true);
            });
        }
        finish(body, false);
    };

    const notFound = (req, res) =>
        send(req, res, 404, Buffer.from("Not found"), "text/plain; charset=utf-8");

    const fileCache = new Map();
    const readStatic = (abs, st) => {
        const key = `${abs}:${st.size}:${st.mtimeMs}`;
        let entry = fileCache.get(key);
        if (!entry) {
            const buf = readFileSync(abs);
            entry = { buf, etag: etagOf(buf) };
            // Bounded: the build has a few hundred files, so this only guards a pathological loop.
            if (fileCache.size > 2000) fileCache.clear();
            fileCache.set(key, entry);
        }
        return entry;
    };

    return createServer((req, res) => {
        if (req.method !== "GET" && req.method !== "HEAD") {
            res.statusCode = 405;
            res.setHeader("Allow", "GET, HEAD");
            return res.end();
        }
        let url;
        try {
            url = new URL(req.url, "http://x");
        } catch {
            res.statusCode = 400;
            return res.end();
        }
        const key = routeKey(url.pathname);
        if (key === null) {
            res.statusCode = 400;
            return res.end();
        }
        const decoded = decodeURIComponent(url.pathname);
        if (key === "/_seo" || key.startsWith("/_seo/")) return notFound(req, res);

        // A real file in dist (never a directory, never outside it).
        const abs = resolve(join(dist, decoded));
        if (abs.startsWith(dist + sep) && existsSync(abs) && statSync(abs).isFile()) {
            const entry = readStatic(abs, statSync(abs));
            const type = TYPES[extname(abs).toLowerCase()] ?? "application/octet-stream";
            return send(req, res, 200, entry.buf, type, {}, entry.etag);
        }
        // A missing built asset is a 404, not the SPA shell.
        if (key.startsWith("/assets/")) return notFound(req, res);

        const page = pickPage(pages, url.pathname, url.search) ?? indexHtml;
        return send(req, res, 200, page, TYPES[".html"], {}, etagOf(page));
    });
};

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
    const server = createSpaServer(process.argv[2] ?? "dist");
    const port = Number(process.env.PORT ?? 3000);
    server.listen(port, "0.0.0.0", () => console.log(`serve-spa: listening on ${port}`));
    // Railway sends SIGTERM on deploy: close and exit promptly (MIP-921).
    for (const sig of ["SIGTERM", "SIGINT"]) {
        process.on(sig, () => {
            server.close(() => process.exit(0));
            setTimeout(() => process.exit(0), 2000).unref();
        });
    }
}
