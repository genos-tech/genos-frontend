import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * iOS Safari zooms the page in when a focused text field's font-size is
 * under 16px, and never zooms back out on blur. The cure is a rule in
 * `App.css`, which nothing else in the suite can see — jsdom applies no
 * CSS and resolves no media queries — so this reads the real stylesheet,
 * the way `MobileComposerCss.test.ts` does for the composer.
 */
const css = readFileSync(join(process.cwd(), "src/App.css"), "utf8");

const QUERY = "(max-width: 899.95px) and (any-pointer: coarse)";

/** Body of the `@media <QUERY>` block. */
const block = (): string => {
    const start = css.indexOf(`@media ${QUERY}`);
    if (start === -1) throw new Error(`no @media ${QUERY} block in App.css`);
    const open = css.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
        if (css[i] === "{") depth += 1;
        if (css[i] === "}") {
            depth -= 1;
            if (depth === 0) return css.slice(open + 1, i);
        }
    }
    throw new Error(`unterminated @media ${QUERY} block`);
};

describe("mobile focus-zoom guard", () => {
    it("applies at the breakpoint `useIsMobile()` uses, and only where the zoom exists", () => {
        // Same 899.95px (Joy `md`) boundary as the JS, so the two can't
        // disagree about what "mobile" means. `any-pointer: coarse` keeps
        // a narrowed desktop window out of it: no touchscreen, no
        // auto-zoom, nothing to fix.
        expect(css).toContain(`@media ${QUERY}`);
    });

    it("floors every text control at the 16px threshold", () => {
        const declarations = block();
        for (const selector of ["input", "textarea", "select"]) {
            expect(declarations).toMatch(new RegExp(`^\\s*${selector}\\s*[,{]`, "m"));
        }
        // Under 16px Safari zooms, at 16px it doesn't. `max()` makes it a
        // floor rather than a flat size, so controls that inherit
        // something larger (the 1.35rem task title) keep it.
        const floor = declarations.match(/font-size:\s*max\((\d+)px/);
        expect(
            floor,
            `expected a max() font-size floor in: ${declarations.trim()}`
        ).not.toBeNull();
        expect(Number(floor?.[1])).toBeGreaterThanOrEqual(16);
    });

    it("outranks the emotion classes the sizes come from", () => {
        // Joy's own styles and every `sx` are single-class rules, which
        // beat a bare element selector on specificity. Without
        // `!important` the floor silently never applies.
        expect(block()).toMatch(/font-size:[^;]*!important/);
    });

    it("stays parseable on iOS below 16.4", () => {
        // A selector list inside `:not()` needs Safari 16.4, and an
        // unparseable selector drops the WHOLE rule — killing the fix on
        // exactly the older iPhones that suffer the zoom. Any future
        // exclusion has to chain `:not()`s instead.
        expect(block()).not.toMatch(/:not\([^)]*,/);
    });
});
