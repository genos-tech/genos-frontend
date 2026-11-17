/**
 * MIP-1668. The note's title row (the title, the Saved chip, the wrap toggles) is drawn over the
 * top of the body editor. The body's scroller used to start at the top of the box, with the row
 * floating over its padding and no background of its own, so scrolled text passed up under the
 * title and the two overlapped. The scroller now starts BELOW the row: text is cut off at the
 * row's lower edge and can never reach it, and the caret (which the browser keeps inside the
 * scrollport) cannot travel up under the title either.
 *
 * jsdom lays nothing out, so this pins the CSS that does it and the one number that has to agree
 * between the stylesheet and the component (the row's height). What it looks like, with
 * measured positions before and after, is in the PR.
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const stripComments = (text: string) =>
    text.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const css = stripComments(readFileSync(join(SRC, "App.css"), "utf8"));
const shell = stripComments(
    readFileSync(join(SRC, "components/editors/genos/GenosNoteEditor.tsx"), "utf8")
);

/** The declarations of the first rule whose selector list is exactly `selectors`. */
const declarations = (selectors: string): string => {
    const escaped = selectors.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\s+/g, "\\s+");
    const match = new RegExp(`(?:^|\\})\\s*${escaped}\\s*\\{([^}]*)\\}`, "m").exec(css);
    if (!match) throw new Error(`no rule for ${selectors}`);
    return match[1];
};

const BOXES = ".bn-note-body-box-light,\n.bn-note-body-box-dark";
const EDITOR = ".bn-note-body-box-light .bn-editor,\n.bn-note-body-box-dark .bn-editor";

describe("the body scrolls below the title row", () => {
    it("the scroller is pushed down by the header and is that much shorter", () => {
        const body = declarations(EDITOR);
        // Margin, not padding: padding is inside the scrollport, so text would scroll into it.
        expect(body).toContain("margin-top: var(--note-header-h);");
        // The same total height as before (margin + height = 92dvh), so the page does not grow.
        expect(body).toContain("height: calc(92dvh - var(--note-header-h));");
        expect(body).toContain("overflow-y: scroll;");
    });

    it("the first block still rests where it did: the padding is what is left of --note-body-top", () => {
        const body = declarations(EDITOR);
        expect(body).toMatch(
            /padding:\s*max\(0px, calc\(var\(--note-body-top\) - var\(--note-header-h\)\)\) 50px 20px\s*var\(--note-body-start\);/
        );
        // 64 at rest (desktop), 56 on a phone: unchanged by this task.
        expect(declarations(BOXES)).toMatch(/--note-body-top:\s*64px;/);
        expect(css).toMatch(/--note-body-top:\s*56px;\s*--note-body-start:\s*44px;/);
    });

    it("the band above the scroller is painted like the editor, opaque, in both modes", () => {
        const body = declarations(
            ".bn-note-body-box-light .bn-editor-section,\n.bn-note-body-box-dark .bn-editor-section"
        );
        expect(body).toContain("background-color: var(--editor-bg);");
        // A token, never a literal colour or a transparent one: the title must not show text.
        expect(body).not.toMatch(/transparent|rgba|#[0-9a-f]{3,8}/i);
    });

    it("a phone's rule and the mobile editor pool take the header off their heights too", () => {
        expect(css).toMatch(/height:\s*calc\(85dvh - var\(--note-header-h\)\);/);
        expect(css).toMatch(
            /\.note-editor-pool-fill \.bn-note-body-box-light \.bn-editor,\s*\.note-editor-pool-fill \.bn-note-body-box-dark \.bn-editor\s*\{\s*height:\s*calc\(100% - var\(--note-header-h\)\);/
        );
    });
});

describe("the header covers the title row, which the component sizes", () => {
    const header = {
        mouse: Number(/--note-header-h:\s*(\d+)px/.exec(declarations(BOXES))?.[1]),
        touch: Number(
            /@media \(pointer: coarse\)\s*\{\s*\.bn-note-body-box-light,\s*\.bn-note-body-box-dark\s*\{\s*--note-header-h:\s*(\d+)px/.exec(
                css
            )?.[1]
        ),
    };
    // The row's own box in GenosNoteEditor: `top` + `minHeight`, for a mouse and for a touch screen.
    const row = {
        mouse: /position:\s*"absolute",\s*top:\s*(\d+),\s*minHeight:\s*(\d+),/.exec(shell),
        touch: /"@media \(pointer: coarse\)":\s*\{\s*\.\.\.headerTouchTargetsSx\["@media \(pointer: coarse\)"\],\s*top:\s*(\d+),\s*minHeight:\s*(\d+),/.exec(
            shell
        ),
    };

    it("both numbers are found", () => {
        expect(header.mouse).toBeGreaterThan(0);
        expect(header.touch).toBeGreaterThan(0);
        expect(row.mouse).not.toBeNull();
        expect(row.touch).not.toBeNull();
    });

    it("the header reaches the row's lower edge, on a mouse and on a touch screen", () => {
        // Shorter than the row, and the bottom of the title would be drawn over scrolled text.
        expect(header.mouse).toBeGreaterThanOrEqual(Number(row.mouse![1]) + Number(row.mouse![2]));
        expect(header.touch).toBeGreaterThanOrEqual(Number(row.touch![1]) + Number(row.touch![2]));
    });

    it("the header is never below where the first block rests (the padding would go negative)", () => {
        const restTops = [...css.matchAll(/--note-body-top:\s*(\d+)px/g)].map((m) => Number(m[1]));
        expect(restTops.length).toBeGreaterThanOrEqual(2);
        expect(Math.min(...restTops)).toBeGreaterThanOrEqual(Math.max(header.mouse, header.touch));
    });
});
