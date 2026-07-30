import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The mobile composer's sizing lives in `App.css`, not in a component, so
 * nothing in the type checker or the component tests can see it. This
 * loads the real stylesheet and asserts the invariants that broke — the
 * same approach `ServiceWorkerCaching.test.ts` takes for `public/sw.js`.
 */
const css = readFileSync(join(process.cwd(), "src/App.css"), "utf8");

/** Body of the first `@media (<query>)` block whose query matches. */
const mediaBlock = (query: string): string => {
    const start = css.indexOf(`@media ${query}`);
    if (start === -1) throw new Error(`no @media ${query} block in App.css`);
    const open = css.indexOf("{", start);
    let depth = 0;
    for (let i = open; i < css.length; i += 1) {
        if (css[i] === "{") depth += 1;
        if (css[i] === "}") {
            depth -= 1;
            if (depth === 0) return css.slice(open + 1, i);
        }
    }
    throw new Error(`unterminated @media ${query} block`);
};

const rule = (block: string, selector: string): string => {
    const at = block.indexOf(selector);
    if (at === -1) throw new Error(`no rule for ${selector}`);
    const open = block.indexOf("{", at);
    return block.slice(open + 1, block.indexOf("}", open));
};

const px = (declarations: string, prop: string): number => {
    const m = declarations.match(new RegExp(`${prop}\\s*:\\s*(\\d+(?:\\.\\d+)?)px`));
    if (!m) throw new Error(`no ${prop} in: ${declarations.trim()}`);
    return Number(m[1]);
};

const MOBILE = "(max-width: 899.95px)";

describe("mobile composer sizing", () => {
    it("matches the breakpoint `useIsMobile()` uses", () => {
        // 899.95px is Joy's `md` boundary. The pre-existing mobile block is
        // `max-width: 480px`, so a 600px viewport got desktop heights while
        // the JS had already switched the toolbar to its mobile shape.
        expect(css).toContain(`@media ${MOBILE}`);
    });

    it("wins the 768-1023px overlap by coming last in the file", () => {
        // Media queries add no specificity, so source order is the ONLY
        // thing making this block beat `@media (min-width: 768px) and
        // (max-width: 1023px)` between 768 and 900. Move it up and the
        // regression returns silently.
        expect(css.indexOf(`@media ${MOBILE}`)).toBeGreaterThan(
            css.indexOf("@media (min-width: 768px) and (max-width: 1023px)")
        );
        expect(css.indexOf(`@media ${MOBILE}`)).toBeGreaterThan(
            css.indexOf("@media (min-width: 1024px)")
        );
    });

    for (const box of ["bn-chat-editor-box", "bn-task-comment-box"] as const) {
        describe(box, () => {
            const declarations = () => rule(mediaBlock(MOBILE), `.${box}-light .bn-editor`);

            it("reserves more top padding than the floating toolbar is tall", () => {
                // THE BUG: the toolbar is ~40px on mobile and sat over the
                // content, so anything less than that covered the first
                // line typed.
                expect(px(declarations(), "padding-top")).toBeGreaterThan(40);
            });

            it("is shorter than it was — the composer shouldn't own a third of the screen", () => {
                const mobile = declarations();
                // Previous mobile values were 150 / 400-ish; the ask was
                // roughly -30%.
                expect(px(mobile, "min-height")).toBeLessThanOrEqual(105);
                expect(px(mobile, "max-height")).toBeLessThan(300);
            });

            it("still leaves room to type under the toolbar", () => {
                // A `min-height` at or below the padding would collapse the
                // writing area to nothing.
                const mobile = declarations();
                expect(px(mobile, "min-height") - px(mobile, "padding-top")).toBeGreaterThan(40);
            });
        });
    }
});
