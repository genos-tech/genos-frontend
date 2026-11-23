// @vitest-environment node
// MIP-2228: an HTML note's inline scripts RUN under the production app's CSP, in a real browser.
//
// The bug this pins: the page used to be an `<iframe srcdoc>`, a `srcdoc` document inherits the
// embedding app's CSP, and the production CSP (`generate-serve-config.mjs`) says `script-src 'self'`,
// so every inline `<script>` of every HTML note was blocked and the pages looked static. jsdom cannot
// see a CSP, so this runs headless Chrome against two local servers on two origins:
//
//   app  the real production headers, i.e. the `**` rule of the `serve.json` the build script writes
//        (run here with the app/API origins pointed at these servers), on a page that embeds the frame
//        exactly as `HtmlNoteView` does (`sandbox="allow-scripts"`, `src` = the API's page URL), with
//        only an EXTERNAL script, because the policy forbids an inline one.
//   api  the page route: the sample page with the header policy genos-api sends. `PAGE_CSP` below must
//        equal `EXPECTED_CSP` of genos-api `origin/tests/test_html_note_pages.py` apart from
//        `frame-ancestors`, which names whichever origin embeds it.
//
// What it proves, one Chrome run each: (1) the inline script runs inside the frame under the production
// CSP and can reach nothing (cookie, storage, parent, top, popups, fetch, images: all refused, and the
// "evil" server sees no request); (2) the SAME page as `srcdoc` does NOT run, so this test fails on the
// old design and cannot pass by accident; (3) the app's `frame-src` allows the page route and no other
// URL, not even on the same API host; (4) opened directly in a tab the page is still a sandbox with no
// origin (the real route also refuses a load that is not a frame's, `Sec-Fetch-Dest`, and spends its
// URL once; those are genos-api's tests, this is the second line should a header check be bypassed).
//
// Needs Chrome (`CHROME_BIN`, or google-chrome / chromium on PATH; GitHub's ubuntu runners have it).
// Where there is none the tests skip, except under CI, where a missing browser fails loudly.
import { execFile, execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import type { AddressInfo } from "node:net";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { HTML_NOTE_SANDBOX } from "../features/notes/common/utils/htmlNote";

const run = promisify(execFile);
const SCRIPT = join(process.cwd(), "scripts", "generate-serve-config.mjs");

const findChrome = (): string | null => {
    const candidates = [
        process.env.CHROME_BIN,
        "google-chrome",
        "google-chrome-stable",
        "chromium",
        "chromium-browser",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    ].filter((c): c is string => Boolean(c));
    for (const bin of candidates) {
        try {
            execFileSync(bin, ["--version"], { stdio: "pipe", timeout: 15_000 });
            return bin;
        } catch {
            // try the next
        }
    }
    return null;
};
const CHROME = findChrome();
if (!CHROME && process.env.CI) {
    throw new Error("htmlNoteProductionCsp: no Chrome found on a CI runner (set CHROME_BIN)");
}

/** The header policy of genos-api's `/h/<token>` route (see the header comment). */
const pageCsp = (frameAncestors: string) =>
    [
        "sandbox allow-scripts",
        "default-src 'none'",
        "script-src 'unsafe-inline'",
        "style-src 'unsafe-inline'",
        "img-src data: blob:",
        "font-src data:",
        "media-src data: blob:",
        "connect-src 'none'",
        "form-action 'none'",
        "object-src 'none'",
        "base-uri 'none'",
        "frame-src 'none'",
        "worker-src 'none'",
        "manifest-src 'none'",
        `frame-ancestors ${frameAncestors}`,
    ].join("; ");

type Listening = { server: Server; origin: string; hits: string[] };

const listen = (handler: (req: IncomingMessage, res: ServerResponse) => void) =>
    new Promise<Listening>((resolve) => {
        const hits: string[] = [];
        const server = createServer((req, res) => {
            hits.push(`${req.method} ${req.url}`);
            handler(req, res);
        });
        server.listen(0, "127.0.0.1", () => {
            const { port } = server.address() as AddressInfo;
            resolve({ server, origin: `http://127.0.0.1:${port}`, hits });
        });
    });

let app: Listening;
let api: Listening;
let evil: Listening;
let appHeaders: [string, string][] = [];
let tmp = "";

const samplePage =
    () => `<!doctype html><html><head><meta charset="utf-8"><title>Sample</title></head>
<body><h1 id="h">inner page</h1>
<script>
(function () {
    var r = { ran: true };
    function t(name, f) {
        try { r[name] = f(); } catch (e) { r[name] = "threw:" + (e && e.name); }
    }
    t("cookie", function () { return document.cookie; });
    t("storage", function () { return typeof localStorage; });
    t("parentDoc", function () { return typeof parent.document.title; });
    t("topLocation", function () { return top.location.href; });
    t("popup", function () { return String(window.open(${JSON.stringify(evil.origin)} + "/popup")); });
    var img = new Image();
    img.onerror = function () { r.image = "blocked"; };
    img.onload = function () { r.image = "loaded"; };
    img.src = ${JSON.stringify(evil.origin)} + "/pixel.png";
    fetch(${JSON.stringify(evil.origin)} + "/fetch").then(
        function () { r.fetch = "allowed"; },
        function () { r.fetch = "blocked"; }
    );
    setTimeout(function () {
        document.getElementById("h").textContent = "inline script ran";
        var pre = document.createElement("pre");
        pre.id = "direct";
        pre.textContent = JSON.stringify(r);
        document.body.appendChild(pre);
        try { parent.postMessage({ probe: r }, "*"); } catch (e) {}
    }, 800);
})();
</script></body></html>`;

const escapeAttr = (s: string) => s.replace(/&/g, "&amp;").replace(/"/g, "&quot;");

// The app's own page: only an external script (the production policy forbids an inline one).
const APP_JS = `
const out = { messages: [], violations: [] };
window.addEventListener("message", (e) => out.messages.push(e.data));
document.addEventListener("securitypolicyviolation", (e) =>
    out.violations.push({ directive: e.violatedDirective, blocked: e.blockedURI }));
setTimeout(() => { document.getElementById("result").textContent = JSON.stringify(out); }, 3500);
`;

const appPage = (mode: string): string => {
    const sandbox = `sandbox="${HTML_NOTE_SANDBOX}" referrerpolicy="no-referrer"`;
    const frame =
        mode === "srcdoc"
            ? `<iframe ${sandbox} srcdoc="${escapeAttr(samplePage())}"></iframe>`
            : mode === "other-route"
              ? `<iframe ${sandbox} src="${api.origin}/api/v3/anything"></iframe>`
              : `<iframe ${sandbox} src="${api.origin}/h/a-signed-token"></iframe>`;
    return `<!doctype html><meta charset="utf-8"><title>app</title>${frame}<pre id="result">waiting</pre><script src="/app.js"></script>`;
};

beforeAll(async () => {
    if (!CHROME) return;
    tmp = mkdtempSync(join(tmpdir(), "html-note-csp-"));
    evil = await listen((_req, res) => {
        res.writeHead(200, { "Content-Type": "text/plain" }).end("evil");
    });
    api = await listen((req, res) => {
        if (req.url?.startsWith("/h/")) {
            res.writeHead(200, {
                "Content-Type": "text/html; charset=utf-8",
                "Content-Security-Policy": pageCsp(app.origin),
                "Referrer-Policy": "no-referrer",
                "Cache-Control": "private, no-store",
            }).end(samplePage());
        } else {
            res.writeHead(200, { "Content-Type": "text/html" }).end("<p>api, not a page</p>");
        }
    });
    app = await listen((req, res) => {
        const url = new URL(req.url ?? "/", app.origin);
        // `?csp=off` is only the control's: the same app page with no policy, to show the control
        // frame DOES run its script when nothing forbids it.
        const headers = Object.fromEntries(
            appHeaders.filter(
                ([key]) =>
                    !(url.searchParams.get("csp") === "off" && key === "Content-Security-Policy")
            )
        );
        if (url.pathname === "/app.js") {
            res.writeHead(200, { ...headers, "Content-Type": "text/javascript" }).end(APP_JS);
        } else {
            res.writeHead(200, { ...headers, "Content-Type": "text/html; charset=utf-8" }).end(
                appPage(url.searchParams.get("mode") ?? "frame")
            );
        }
    });

    // The production headers: run the real build script with this app's and API's origins.
    execFileSync("node", [SCRIPT], {
        env: {
            PATH: process.env.PATH ?? "",
            SERVE_CONFIG_OUT_DIR: tmp,
            VITE_API_BASE_URL: `${api.origin}/api/v2`,
            VITE_DJANGO_URL: api.origin,
            VITE_MEDIA_ROOT_DJANGO: `${api.origin}/media`,
            VITE_WS_BASE_URL: app.origin,
            VITE_COLLAB_URL: "ws://127.0.0.1:1",
        },
        stdio: "pipe",
    });
    const cfg = JSON.parse(readFileSync(join(tmp, "serve.json"), "utf8"));
    appHeaders = cfg.headers
        .find((rule: { source: string }) => rule.source === "**")
        .headers.map((h: { key: string; value: string }) => [h.key, h.value]);
}, 60_000);

afterAll(async () => {
    for (const s of [app, api, evil]) s?.server.close();
    if (tmp) rmSync(tmp, { recursive: true, force: true });
});

/** Open `url` in headless Chrome, let its timers run, and answer the `#result` element's JSON. */
const dump = async (url: string, id: string): Promise<Record<string, unknown>> => {
    const profile = mkdtempSync(join(tmpdir(), "html-note-chrome-"));
    try {
        const { stdout } = await run(
            CHROME as string,
            [
                "--headless=new",
                "--no-sandbox",
                "--disable-gpu",
                "--disable-dev-shm-usage",
                "--no-first-run",
                "--disable-extensions",
                // `--virtual-time-budget` only advances timers of the process it runs in. A
                // cross-origin frame would be an out-of-process frame whose timers it does not
                // drive, so the frame is kept in the page's process: the policies under test are
                // enforced the same way, only the process boundary is gone.
                "--disable-site-isolation-trials",
                "--disable-features=site-per-process,IsolateOrigins",
                `--user-data-dir=${profile}`,
                "--virtual-time-budget=9000",
                "--dump-dom",
                url,
            ],
            { timeout: 90_000, maxBuffer: 8 * 1024 * 1024 }
        );
        const match = new RegExp(`<pre id="${id}"[^>]*>([\\s\\S]*?)</pre>`).exec(stdout);
        if (!match) throw new Error(`no #${id} in the dumped page:\n${stdout.slice(0, 2000)}`);
        const text = match[1]
            .replace(/&quot;/g, '"')
            .replace(/&lt;/g, "<")
            .replace(/&amp;/g, "&");
        return JSON.parse(text) as Record<string, unknown>;
    } finally {
        rmSync(profile, { recursive: true, force: true });
    }
};

type AppResult = {
    messages: { probe?: Record<string, unknown> }[];
    violations: { directive: string; blocked: string }[];
};

describe.skipIf(!CHROME)("HTML note page under the production CSP, in Chrome", () => {
    it("runs the page's inline script in the frame, and the script can reach nothing", async () => {
        evil.hits.length = 0;
        const result = (await dump(`${app.origin}/?mode=frame`, "result")) as unknown as AppResult;

        const probe = result.messages.find((m) => m.probe)?.probe;
        expect(probe, JSON.stringify({ result, api: api.hits, csp: appHeaders[0] })).toBeTruthy();
        expect(probe!.ran).toBe(true);

        // an opaque origin: no cookie, no storage, no parent or top, and a popup is refused
        expect(probe!.cookie).toBe("threw:SecurityError");
        expect(probe!.storage).toBe("threw:SecurityError");
        expect(probe!.parentDoc).toBe("threw:SecurityError");
        expect(probe!.topLocation).toBe("threw:SecurityError");
        expect(probe!.popup).toBe("null");
        // and no network: fetch and an image are refused by the page's policy
        expect(probe!.fetch).toBe("blocked");
        expect(probe!.image).toBe("blocked");
        expect(evil.hits).toEqual([]);

        // the app's own policy refused nothing about this frame
        expect(result.violations.filter((v) => v.directive.startsWith("frame-src"))).toEqual([]);
    }, 120_000);

    it("control: the same page as a srcdoc frame does NOT run (the bug this fixes)", async () => {
        const result = (await dump(
            `${app.origin}/?mode=srcdoc`,
            "result"
        )) as unknown as AppResult;
        expect(result.messages.find((m) => m.probe)).toBeUndefined();
    }, 120_000);

    it("control of the control: that srcdoc frame runs when the app has no policy", async () => {
        const result = (await dump(
            `${app.origin}/?mode=srcdoc&csp=off`,
            "result"
        )) as unknown as AppResult;
        // so the srcdoc page above was stopped by the app's CSP, not by anything else
        expect(result.messages.find((m) => m.probe)?.probe?.ran).toBe(true);
    }, 120_000);

    it("the app's frame-src allows the page route and no other URL on the API host", async () => {
        api.hits.length = 0;
        const result = (await dump(
            `${app.origin}/?mode=other-route`,
            "result"
        )) as unknown as AppResult;
        expect(result.violations.map((v) => v.directive)).toContain("frame-src");
        expect(api.hits.filter((h) => h.includes("/api/v3/anything"))).toEqual([]);
    }, 120_000);

    it("opened directly in a tab the page is still a sandbox with no origin", async () => {
        const probe = (await dump(`${api.origin}/h/a-signed-token`, "direct")) as Record<
            string,
            unknown
        >;
        expect(probe.ran).toBe(true);
        expect(probe.cookie).toBe("threw:SecurityError");
        expect(probe.storage).toBe("threw:SecurityError");
        expect(probe.fetch).toBe("blocked");
    }, 120_000);
});
