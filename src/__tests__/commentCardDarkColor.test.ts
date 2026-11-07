/**
 * In dark mode the floating comment card has to stand out from the editor
 * behind it (MIP-1064).
 *
 * BlockNote's dark theme gives the menu background (which the card uses) and the
 * editor the same #1f1f1f, and the card's border a darker #161616, so an open
 * comment card on a dark note was the page's own black and could not be found.
 * App.css sets a lighter background and a visible border for it. Since MIP-1131 those are
 * design-token roles (`--g-surface-raised`, `--g-border-strong`) instead of two hex values, so
 * "lighter than the editor" is checked on the roles' real values, for every color theme.
 *
 * Two things make this easy to undo without noticing:
 *   - The override only lands if it out-specifies BlockNote's
 *     `.bn-mantine .bn-thread` (0,2,0): that sheet arrives with the lazily
 *     imported editor chunk, after App.css, so a tie is lost. The portal element
 *     carries `bn-mantine` and `data-color-scheme` on ONE node, so the selector
 *     is a compound, not a descendant.
 *   - Someone "tidying" the two colours back to the editor's would pass every
 *     other test.
 *
 * vitest processes no CSS and jsdom evaluates none of this, so this asserts
 * against the stylesheet source, like `quoteBlockColors.test.ts`.
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { THEME_IDS } from "../theme/themePalettes";
import { composite, luminance } from "../theme/tokens/color";
import { buildRoles } from "../theme/tokens/roles";

const appCss = readFileSync(join(__dirname, "..", "App.css"), "utf8");

const variable = (name: string): string => {
    const match = new RegExp(`${name}:\\s*([^;]+);`).exec(appCss);
    if (!match) throw new Error(`${name} is not defined in App.css`);
    return match[1].trim().toLowerCase();
};

/** The declarations of the rule whose selector is exactly `selector`. */
const rule = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(appCss);
    if (!match) throw new Error(`no rule for ${selector}`);
    return match[1];
};

describe("dark-mode comment card", () => {
    const declarations = rule('.bn-mantine[data-color-scheme="dark"] .bn-thread');

    it("is not the editor's colour", () => {
        expect(variable("--comment-card-bg")).not.toBe(variable("--editor-bg"));
        expect(declarations).toContain("background-color: var(--comment-card-bg)");
    });

    it("takes the card from the raised-surface role and the border from the strong border role", () => {
        expect(variable("--comment-card-bg")).toBe("var(--g-surface-raised)");
        expect(variable("--comment-card-border")).toBe("var(--g-border-strong)");
        expect(variable("--editor-bg")).toBe("var(--g-bg-subtle)");
    });

    it.each(THEME_IDS)("is lighter than the editor, not darker (%s)", (theme) => {
        const r = buildRoles(theme, "dark");
        expect(luminance(r.surfaceRaised)).toBeGreaterThan(luminance(r.bgSubtle));
    });

    it.each(THEME_IDS)("has a border that shows against the editor and the card (%s)", (theme) => {
        const r = buildRoles(theme, "dark");
        const edge = composite(r.borderStrong.hex, r.borderStrong.a, r.surfaceRaised);
        expect(luminance(edge)).toBeGreaterThan(luminance(r.surfaceRaised));
        expect(luminance(edge)).toBeGreaterThan(luminance(r.bgSubtle));
        expect(declarations).toContain("border-color: var(--comment-card-border)");
    });

    it("out-specifies BlockNote's `.bn-mantine .bn-thread`", () => {
        // [attr] + two classes = (0,3,0) against (0,2,0): an attribute AND both classes.
        const selector = '.bn-mantine[data-color-scheme="dark"] .bn-thread';
        expect(selector.match(/\[[^\]]+\]/g)).toHaveLength(1);
        expect(selector.match(/\.[a-z-]+/g)).toHaveLength(2);
        expect(appCss).toContain(`${selector} {`);
    });

    it("leaves light mode alone", () => {
        expect(appCss).not.toMatch(/data-color-scheme="light"\]\s+\.bn-thread/);
    });
});
