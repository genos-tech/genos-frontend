// Generates dist/serve.json — security headers INCLUDING a
// Content-Security-Policy whose allowed origins are derived from the
// same VITE_* env the bundle itself is built with, so the policy is
// correct in every environment (Railway, Cloud Run, local preview)
// without hardcoding hosts.
//
// Runs automatically after `npm run build` (postbuild) and explicitly
// in Dockerfile.cloudrun. The static `public/serve.json` (headers, no
// CSP) is Vite-copied into dist first and acts as the baseline for any
// build path that skips this script; this file OVERWRITES it with the
// full policy.
//
// The CSP only takes effect on `serve -s dist` deployments — the Vite
// dev server doesn't read serve.json, so local dev is never blocked.
//
// Directive rationale (from a full audit of what the app loads):
//   script-src  'self' + PostHog origin (posthog-js is bundled, but if
//               session recording is ever enabled it lazy-loads
//               recorder.js from its api_host as a <script>).
//               No 'unsafe-inline'/'unsafe-eval': index.html has only a
//               src= module script and no dependency evals.
//   style-src   'unsafe-inline' is required — MUI Joy/Emotion and
//               BlockNote inject runtime <style> without nonces.
//   img-src     any https origin: agent/Spotlight answers render
//               markdown that may reference external images, and
//               images can't execute. data:/blob: for pasted images
//               and object-URL previews.
//   connect-src the API/Django/media/sockets/collab/PostHog origins,
//               with ws(s) variants for the socket hosts (socket.io
//               long-polls over http(s) before upgrading).
//   worker-src  'self' blob: — Vite-bundled module workers (db/workers).
//   frame-src   'none' — the app embeds no iframes; frame-ancestors
//               'none' mirrors X-Frame-Options: DENY.

import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const originOf = (raw) => {
    if (!raw) return null;
    try {
        return new URL(raw).origin;
    } catch {
        console.warn(`[serve-config] ignoring unparseable URL: ${raw}`);
        return null;
    }
};

// http(s) → ws(s) counterpart (and vice versa) so a host is usable for
// both transport schemes regardless of which scheme the env var used.
const schemeVariants = (origin) => {
    if (!origin) return [];
    if (origin.startsWith("https:")) return [origin, origin.replace(/^https:/, "wss:")];
    if (origin.startsWith("http:")) return [origin, origin.replace(/^http:/, "ws:")];
    if (origin.startsWith("wss:")) return [origin, origin.replace(/^wss:/, "https:")];
    if (origin.startsWith("ws:")) return [origin, origin.replace(/^ws:/, "http:")];
    return [origin];
};

const env = process.env;
const apiOrigin = originOf(env.VITE_API_BASE_URL) ?? "http://localhost:8890";
const djangoOrigin = originOf(env.VITE_DJANGO_URL) ?? apiOrigin;
const mediaOrigin = originOf(env.VITE_MEDIA_ROOT_DJANGO) ?? djangoOrigin;
const socketsOrigin = originOf(env.VITE_WS_BASE_URL) ?? "http://localhost:8889";
const collabOrigin = originOf(env.VITE_COLLAB_URL) ?? "ws://localhost:8891";
const posthogOrigin = originOf(env.VITE_POSTHOG_HOST);

// posthog-js lazy-loads its extension scripts (web-vitals,
// dead-clicks-autocapture, the /array/<key>/config bootstrap, session
// recorder, …) from a dedicated ASSETS subdomain, not the api_host:
// us.i.posthog.com → us-assets.i.posthog.com (same pattern for eu).
// Both script-src and connect-src need it or PostHog logs CSP
// violations on every page load in prod.
const posthogAssetsOrigin = posthogOrigin
    ? posthogOrigin.replace(
          /^(https?:\/\/)([a-z0-9-]+)\.i\.posthog\.com$/,
          "$1$2-assets.i.posthog.com"
      )
    : null;

const uniq = (values) => [...new Set(values.filter(Boolean))];

const connectSrc = uniq([
    "'self'",
    "blob:",
    apiOrigin,
    djangoOrigin,
    mediaOrigin,
    ...schemeVariants(socketsOrigin),
    ...schemeVariants(collabOrigin),
    posthogOrigin,
    posthogAssetsOrigin,
]);

const csp = [
    `default-src 'self'`,
    `script-src ${uniq(["'self'", posthogOrigin, posthogAssetsOrigin]).join(" ")}`,
    `style-src 'self' 'unsafe-inline'`,
    `img-src 'self' data: blob: https:`,
    `font-src 'self' data:`,
    `connect-src ${connectSrc.join(" ")}`,
    `media-src ${uniq(["'self'", "blob:", "data:", djangoOrigin, mediaOrigin]).join(" ")}`,
    `worker-src 'self' blob:`,
    `frame-src 'none'`,
    `object-src 'none'`,
    `base-uri 'self'`,
    `form-action 'self'`,
    `frame-ancestors 'none'`,
].join("; ");

const config = {
    rewrites: [{ source: "**", destination: "/index.html" }],
    // NOTE: do NOT add serve-handler's `etag` key here — the serve CLI's
    // serve.json schema rejects unknown properties and the process
    // refuses to boot ("must NOT have additional properties"). It
    // already sends an ETag on every response, which is what makes the
    // `no-cache` default below cost a 304 rather than a re-download.
    //
    // Header rules are matched against the RESOLVED file path (so SPA
    // routes rewritten to /index.html hit the "**" rule as index.html),
    // and every matching rule applies in order — later same-key values
    // overwrite earlier ones. That makes "no-cache by default, longer
    // for specific paths" expressible as rule order.
    headers: [
        {
            source: "**",
            headers: [
                { key: "Content-Security-Policy", value: csp },
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "X-Frame-Options", value: "DENY" },
                { key: "Referrer-Policy", value: "same-origin" },
                { key: "Strict-Transport-Security", value: "max-age=31536000" },
                {
                    key: "Permissions-Policy",
                    value: "camera=(), microphone=(), geolocation=()",
                },
                // Always revalidate (cheap 304s via the etag). Without any
                // Cache-Control, browsers heuristically cached index.html
                // and kept serving a pre-deploy bundle after releases —
                // this also covers sw.js and manifest.webmanifest.
                { key: "Cache-Control", value: "no-cache" },
            ],
        },
        {
            // PWA icons / root logos are mutable (not content-hashed):
            // cache a day, then revalidate.
            source: "{icons/**,*.png}",
            headers: [{ key: "Cache-Control", value: "public, max-age=86400" }],
        },
        {
            // Everything under assets/ is Vite content-hashed — immutable.
            source: "assets/**",
            headers: [{ key: "Cache-Control", value: "public, max-age=31536000, immutable" }],
        },
    ],
};

const outDir = join(root, "dist");
mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "serve.json"), JSON.stringify(config, null, 4) + "\n");
console.log(`[serve-config] wrote dist/serve.json`);
console.log(`[serve-config] CSP: ${csp}`);
