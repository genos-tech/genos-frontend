/**
 * MIP-1155: no focus ring on a mouse click, the token ring for the keyboard.
 *
 * index.css carried the Vite template's `button:focus { outline: 4px auto }`.
 * jsdom has no `:focus-visible` heuristics, so this pins the stylesheet
 * rules themselves; the behaviour was checked in a real browser (evidence
 * doc MIP-1155).
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = dirname(fileURLToPath(import.meta.url));
const css = readFileSync(join(here, "../index.css"), "utf8").replace(/\/\*[\s\S]*?\*\//g, "");

const rule = (selector: string) => {
    const m = css.match(
        new RegExp(`(^|\\s)${selector.replace(/[\\()]/g, "\\$&")}\\s*\\{([^}]*)\\}`)
    );
    return m ? m[2] : null;
};

describe("button focus ring", () => {
    it("no longer rings on every :focus (the Vite template's 4px auto)", () => {
        expect(css).not.toMatch(/button:focus\s*[,{]/);
        expect(css).not.toContain("-webkit-focus-ring-color");
        expect(css).not.toContain("4px auto");
    });

    it("hides the outline for a focus that is not keyboard", () => {
        expect(rule("button:focus:not(:focus-visible)")).toMatch(/outline:\s*none/);
    });

    it("rings :focus-visible with the token focus ring", () => {
        const body = rule("button:focus-visible");
        expect(body).toMatch(/outline:\s*2px solid var\(--g-focus\)/);
        expect(body).toMatch(/outline-offset:\s*2px/);
    });
});
