/**
 * MIP-1876: the cheap, always-on half of the 320 px guarantee. jsdom lays nothing out, so the
 * real check is `scripts/layout-check.mjs` (real Chrome, manual). This only pins the CSS the
 * claim on /accessibility rests on: the layout floor is 320 px and the shell uses it.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(resolve(__dirname, "../index.css"), "utf8");

describe("320 px layout floor (MIP-1876)", () => {
    it("--min-width is at least 320px and is applied to the page", () => {
        const m = css.match(/--min-width:\s*(\d+)px/);
        expect(m).not.toBeNull();
        expect(Number(m![1])).toBeGreaterThanOrEqual(320);
        expect(css).toMatch(/min-width:\s*var\(--min-width\)/);
    });
});
