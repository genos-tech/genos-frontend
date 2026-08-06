/**
 * A quoted message has to look quoted, in every wrapper `MessageBody` can
 * render into.
 *
 * `@blocknote/core` already draws the rule + indent, but with ONE colour
 * (#7d797a) chosen for a white page. App.css re-colours it per wrapper so it
 * stays legible on the dark and indigo backgrounds. Two things make that
 * fragile enough to pin down here:
 *
 *   - The override only lands if the selector out-specifies BlockNote's
 *     `[data-content-type=quote] blockquote`. A bare
 *     `.wrapper blockquote` TIES it, and the tie is broken by stylesheet
 *     order — where BlockNote's arrives with a lazily-imported editor chunk,
 *     i.e. after App.css. Dropping the attribute step looks like tidying and
 *     silently reverts the colour.
 *   - A new wrapper is easy to add (`customClassName` on `MessageBody`)
 *     without noticing the quote colour didn't come with it.
 *
 * vitest processes no CSS (no `css: true`) and jsdom evaluates none of this,
 * so this asserts against the stylesheet source — same approach as
 * `blockNoteCommentPopupZIndex.test.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const appCss = readFileSync(join(__dirname, "..", "App.css"), "utf8");

/** Every wrapper class `MessageBody` resolves to: the four default bubble
 *  variants, plus `${customClassName}-${mode}` for each caller that passes
 *  one (`InboxBubble`, `TaskCommentBubble`). */
const WRAPPERS = [
    "bn-message-bubble-box-light",
    "bn-message-bubble-box-light-me",
    "bn-message-bubble-box-dark",
    "bn-message-bubble-box-dark-me",
    "task-comment-preview-light",
    "task-comment-preview-dark",
    "inbox-preview-light",
    "inbox-preview-dark",
];

/** The `border-left-color` + `color` pair declared for `wrapper`, or null. */
function quoteRule(wrapper: string): { border: string; color: string } | null {
    const match = appCss.match(
        new RegExp(
            `\\.${wrapper}\\s+\\[data-content-type="quote"\\]\\s+blockquote\\s*\\{([^}]*)\\}`
        )
    );
    if (!match) return null;
    const border = match[1].match(/border-left-color:\s*([^;]+);/);
    const color = match[1].match(/(?:^|[;\s])color:\s*([^;]+);/);
    if (!border || !color) return null;
    return { border: border[1].trim(), color: color[1].trim() };
}

describe("quote block colours", () => {
    for (const wrapper of WRAPPERS) {
        it(`re-colours quotes for .${wrapper}`, () => {
            const rule = quoteRule(wrapper);
            expect(
                rule,
                `.${wrapper} has no quote rule, so quotes there keep BlockNote's ` +
                    `light-page grey. Add one next to the wrapper's \`code\` rule.`
            ).not.toBeNull();
            // BlockNote's own colour, which is the thing being overridden.
            expect(rule!.color.toLowerCase()).not.toBe("#7d797a");
            expect(rule!.border.toLowerCase()).not.toBe("#7d797a");
        });
    }

    it("never states a quote colour with a selector BlockNote can tie", () => {
        // `.wrapper blockquote` (no attribute step) is specificity 0-1-1,
        // exactly BlockNote's, so it wins or loses on stylesheet order.
        for (const wrapper of WRAPPERS) {
            const tying = new RegExp(`\\.${wrapper}\\s+blockquote\\s*\\{`);
            expect(
                appCss,
                `.${wrapper} states a quote colour at a specificity ` +
                    `BlockNote's stylesheet ties`
            ).not.toMatch(tying);
        }
    });
});
