/**
 * "Try the demo" must not loop (MIP-1774).
 *
 * `/` is the home page for a signed-out visitor since MIP-1747, so a demo call-to-action that
 * links to the root lands on the page it is on. The demo button lives on the sign-in form, so
 * every marketing call-to-action goes to `DEMO_URL` (`/signin`).
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

import { APP_URL, DEMO_URL } from "../lp/kit/links";

const lpDir = resolve(__dirname, "../lp");

const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = resolve(dir, name);
        if (statSync(path).isDirectory()) return sources(path);
        return /\.tsx?$/.test(name) ? [path] : [];
    });

describe("marketing demo links", () => {
    it("DEMO_URL is the sign-in form, not the root address", () => {
        expect(DEMO_URL).toBe(`${APP_URL}/signin`);
        expect(DEMO_URL).not.toBe(APP_URL);
    });

    it("no marketing page links a call-to-action to the bare root address", () => {
        const offenders = sources(lpDir)
            .filter((file) => !file.endsWith("kit/links.ts"))
            .filter((file) => /appHref\(\s*APP_URL\s*\)/.test(readFileSync(file, "utf8")));
        expect(offenders).toEqual([]);
    });
});
