import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * MIP-1953: an image in a note editor must never be wider than the editor's
 * content box. A bare `max-width: 600px` is wider than a 390 px phone, so a
 * 900 px picture ran off the right edge with its resize handle. Each editor
 * image rule caps at the smaller of its px ceiling and 100% of its container.
 */
const css = readFileSync(join(process.cwd(), "src/App.css"), "utf8");

const SELECTORS = [
    ".bn-editor img",
    ".bn-task-body-box-light .bn-editor img",
    ".bn-task-body-box-dark .bn-editor img",
    ".bn-note-body-box-light .bn-editor img",
    ".bn-note-body-box-dark .bn-editor img",
];

describe("editor image max-width", () => {
    it.each(SELECTORS)("%s is capped at min(<px>, 100%)", (selector) => {
        const start = css.indexOf(`\n${selector} {`);
        expect(start).toBeGreaterThan(-1);
        const body = css.slice(start, css.indexOf("}", start));
        expect(body).toMatch(/max-width:\s*min\(\d+px,\s*100%\)/);
        expect(body).toMatch(/height:\s*auto/);
    });
});
