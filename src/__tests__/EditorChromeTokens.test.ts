/**
 * The editor chrome takes its colors from the design tokens (MIP-1131).
 *
 * vitest processes no CSS and jsdom evaluates none of it, so this asserts against the
 * stylesheet source (same approach as `commentCardDarkColor.test.ts`). Pinned:
 *  - BlockNote's whole `--bn-colors-*` set is pointed at `--g-*` roles in ONE block, except
 *    the `highlights` palette (document content a person chose, not chrome);
 *  - the editor boxes (chat, task comment, task body, note body, todo notes) carry no literal
 *    color: one rule serves light and dark, because the tokens switch with the mode;
 *  - what Ken decided not to touch (MIP-1011, 11-05) is still there: the image size caps,
 *    the 13300 z-index lift and the `:has(~ .MuiModal-root)` hide rule.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const css = readFileSync(join(__dirname, "..", "App.css"), "utf8");

/** Declarations of the first rule whose selector list contains `selector` exactly. */
const ruleBody = (selector: string): string => {
    const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const match = new RegExp(
        `(?:^|[},/])\\s*(?:[^{}]*,\\s*)?${escaped}\\s*(?:,[^{}]*)?\\{([^}]*)\\}`,
        "m"
    ).exec(css);
    if (!match) throw new Error(`no rule for ${selector}`);
    return match[1];
};

const BN_COLORS = [
    "editor-text",
    "editor-background",
    "menu-text",
    "menu-background",
    "tooltip-text",
    "tooltip-background",
    "hovered-text",
    "hovered-background",
    "selected-text",
    "selected-background",
    "disabled-text",
    "disabled-background",
    "shadow",
    "border",
    "side-menu",
];

describe("BlockNote chrome variables", () => {
    const block = ruleBody("html .bn-root.bn-root");

    it.each(BN_COLORS)("--bn-colors-%s is a design-token role", (name) => {
        const m = new RegExp(`--bn-colors-${name}:\\s*([^;]+);`).exec(block);
        expect(m, `--bn-colors-${name} is set`).not.toBeNull();
        expect(m![1]).toMatch(/var\(--g-[a-z-]+\)/);
    });

    it("leaves the document highlight palette to BlockNote", () => {
        expect(block).not.toContain("highlights");
    });

    it("out-specifies BlockNote's `.bn-root[data-color-scheme=dark]` (the editor chunk loads later)", () => {
        // html + two classes = (0,2,1) against its (0,2,0): a tie would lose to load order.
        expect(css).toContain("html .bn-root.bn-root {");
    });

    it("radius and shadows come from tokens too", () => {
        expect(block).toMatch(/--bn-border-radius:\s*var\(--g-radius-md\)/);
        expect(block).toMatch(/--bn-shadow-medium:\s*var\(--g-shadow-md\)/);
    });
});

describe("editor boxes", () => {
    const BOXES = [
        "bn-chat-editor-box",
        "bn-task-comment-box",
        "bn-task-body-box",
        "bn-note-body-box",
        "todo-item-notes",
    ];

    it.each(BOXES)("%s: one rule for both modes, painted from the editor roles", (box) => {
        const light = `.${box}-light .bn-editor`;
        const dark = `.${box}-dark .bn-editor`;
        const body = ruleBody(light);
        expect(css).toContain(`${light},\n${dark} {`);
        expect(body).toContain("background-color: var(--editor-bg)");
        const code = ruleBody(`.${box}-light code`);
        expect(code).toContain("var(--editor-code-bg)");
        expect(code).toContain("var(--editor-code-color)");
        // No second, mode-specific copy of the three rules.
        expect(css).not.toMatch(new RegExp(`\\}\\n\\n\\.${box}-dark code\\s*\\{`));
        expect(css).not.toMatch(new RegExp(`\\}\\n\\n\\.${box}-dark \\.bn-editor\\s*\\{`));
    });

    it("the editor roles are tokens", () => {
        for (const [name, role] of [
            ["--editor-bg", "var(--g-bg-subtle)"],
            ["--editor-placeholder", "var(--g-text-tertiary)"],
            ["--editor-code-bg", "var(--g-active)"],
            ["--editor-code-color", "var(--g-text)"],
        ]) {
            expect(css, `${name} is ${role}`).toContain(`${name}: ${role};`);
        }
    });

    it("no editor box rule paints a literal color", () => {
        const boxRules = [
            ...css.matchAll(
                /^\.(?:bn-(?:chat-editor|task-comment|task-body|note-body)-box|todo-item-notes)[^{]*\{[^}]*\}/gm
            ),
        ].map((m) => m[0]);
        expect(boxRules.length).toBeGreaterThan(10);
        const literals = boxRules.filter((r) => /#[0-9a-fA-F]{3,8}\b|rgba?\(\s*\d/.test(r));
        expect(literals).toEqual([]);
    });
});

describe("what stays as it was (MIP-1011)", () => {
    it("keeps the image size caps on the task and note body editors", () => {
        for (const box of ["bn-task-body-box", "bn-note-body-box"]) {
            for (const mode of ["light", "dark"]) {
                const body = ruleBody(`.${box}-${mode} .bn-editor img`);
                expect(body).toContain("max-width: 600px");
                expect(body).toContain("max-height: 600px");
            }
        }
    });

    it("keeps the 13300 z-index lift", () => {
        expect(css).toMatch(/--bn-ui-base-z-index:\s*13300\s*!important/);
        expect(css).toMatch(/\.bn-floating-toolbar\s*\{\s*z-index:\s*13300\s*!important/);
    });

    it("keeps the rule that hides editor UI behind an open modal", () => {
        expect(css).toContain("> *:has(~ .MuiModal-root)");
    });
});
