// The generated Content-Security-Policy, pinned (MIP-734).
//
// `img-src` used to be `'self' data: blob: https:`, so any note, task body or
// chat message that embedded someone else's image URL beaconed to that host
// the moment it rendered. It is now an allowlist. These tests run the real
// build script into a temp directory and read the header it writes, so they
// fail if the directive drifts, whatever the script's internals look like.
import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";

const SCRIPT = join(process.cwd(), "scripts", "generate-serve-config.mjs");
const dirs: string[] = [];

function directives(env: Record<string, string>): Record<string, string[]> {
    const out = mkdtempSync(join(tmpdir(), "serve-config-"));
    dirs.push(out);
    execFileSync("node", [SCRIPT], {
        env: { PATH: process.env.PATH ?? "", SERVE_CONFIG_OUT_DIR: out, ...env },
        stdio: "pipe",
    });
    const cfg = JSON.parse(readFileSync(join(out, "serve.json"), "utf8"));
    const csp: string = cfg.headers
        .flatMap((rule: { headers: { key: string; value: string }[] }) => rule.headers)
        .find((h: { key: string }) => h.key === "Content-Security-Policy").value;
    return Object.fromEntries(
        csp.split(";").map((d) => {
            const [name, ...sources] = d.trim().split(/\s+/);
            return [name, sources];
        })
    );
}

const PROD = {
    VITE_API_BASE_URL: "https://api.genosai.dev/api/v2",
    VITE_DJANGO_URL: "https://api.genosai.dev",
    VITE_MEDIA_ROOT_DJANGO: "https://api.genosai.dev/media",
    VITE_WS_BASE_URL: "https://app.genosai.dev",
    VITE_COLLAB_URL: "wss://backend-collab-production.up.railway.app",
};

afterAll(() => {
    for (const d of dirs) rmSync(d, { recursive: true, force: true });
});

describe("img-src", () => {
    const img = () => directives(PROD)["img-src"];

    it("no longer allows any https origin", () => {
        expect(img()).not.toContain("https:");
        expect(img()).not.toContain("*");
        expect(img().some((s) => s === "http:" || s === "https:")).toBe(false);
    });

    it("keeps what the app needs: self, pasted/object-URL images, our own origins", () => {
        expect(img()).toEqual(expect.arrayContaining(["'self'", "data:", "blob:"]));
        expect(img()).toContain("https://api.genosai.dev");
    });

    it("keeps GIPHY and GitHub avatars loading", () => {
        expect(img()).toContain("https://*.giphy.com");
        expect(img()).toContain("https://avatars.githubusercontent.com");
    });

    it("keeps the one external host existing content embeds", () => {
        expect(img()).toContain("https://img.magnific.com");
    });

    it("follows the build environment for our own origins", () => {
        const other = directives({
            ...PROD,
            VITE_DJANGO_URL: "https://api.staging.example.dev",
            VITE_MEDIA_ROOT_DJANGO: "https://media.staging.example.dev/media",
        })["img-src"];
        expect(other).toContain("https://api.staging.example.dev");
        expect(other).toContain("https://media.staging.example.dev");
        expect(other).not.toContain("https://api.genosai.dev");
    });
});

describe("the rest of the policy is untouched", () => {
    it("still locks down frames, objects, base and framing", () => {
        const d = directives(PROD);
        expect(d["frame-src"]).toEqual(["'none'"]);
        expect(d["object-src"]).toEqual(["'none'"]);
        expect(d["frame-ancestors"]).toEqual(["'none'"]);
        expect(d["base-uri"]).toEqual(["'self'"]);
        expect(d["default-src"]).toEqual(["'self'"]);
    });

    it("never puts a bare scheme source in script-src or connect-src", () => {
        const d = directives(PROD);
        for (const name of ["script-src", "connect-src"]) {
            expect(d[name]).not.toContain("https:");
            expect(d[name]).not.toContain("http:");
        }
    });
});
