/**
 * BlockNote comment popups must stack above the comment card.
 *
 * App.css lifts BlockNote's floating UI base z-index to 1400 so it clears
 * Joy's modals. BlockNote positions each floating element at
 * `calc(var(--bn-ui-base-z-index, 0) + <offset>)`, but its comment popups
 * (reaction emoji picker, comment "⋯" menu) are Mantine popovers that get
 * no zIndex prop and sit on Mantine's default popover layer (300) — which
 * that same base lift pushed *below* the floating comment card (offset 30
 * → 1430). The picker then opened behind the comment it belongs to.
 *
 * The fix is a CSS rule, so there's no component to render: vitest doesn't
 * process CSS (no `css: true`), which is why this asserts the numeric
 * invariant off the stylesheet source instead of a computed style. It's
 * here because the rule's whole value is an ordering relationship that is
 * easy to delete or "tidy" without noticing.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// The largest offset BlockNote itself uses for a floating element; the
// comment card sits at 30. A comment popup has to clear all of them.
const MAX_BLOCKNOTE_OFFSET = 90;

const appCss = readFileSync(join(__dirname, "..", "App.css"), "utf8");

describe("BlockNote comment popup z-index", () => {
    it("pins both comment popups above every BlockNote floating element", () => {
        const rule = appCss.match(
            /\.bn-emoji-picker-popover,\s*\.bn-menu-dropdown\s*\{\s*z-index:\s*calc\(var\(--bn-ui-base-z-index,\s*0\)\s*\+\s*(\d+)\)\s*!important;?\s*\}/
        );

        expect(rule, "the comment-popup z-index rule is missing from App.css").not.toBeNull();
        expect(Number(rule![1])).toBeGreaterThan(MAX_BLOCKNOTE_OFFSET);
    });

    it("keeps the popups on the same base variable as the rest of the editor UI", () => {
        // A literal z-index here would silently drift if the base is ever
        // re-tuned — the popups have to ride the same variable.
        expect(appCss).toMatch(/--bn-ui-base-z-index:\s*\d+\s*!important/);
        expect(appCss).not.toMatch(/\.bn-emoji-picker-popover[^{]*\{\s*z-index:\s*\d+/);
    });
});
