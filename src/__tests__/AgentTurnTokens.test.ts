/**
 * The answer turn and everything it renders takes its color from the theme
 * tokens (`g.*`), so light/dark and the seven color themes are resolved in CSS
 * (MIP-1166, part of MIP-1106).
 *
 * It used to thread an `isDark` flag from the host down to the tool list, the
 * undo control, the approval card and its 24 previews, pick one of two palette
 * objects with it, and keep three hard-coded dark text colors (`DARK_TEXT_*`)
 * that were tuned for a sheet that no longer exists. jsdom cannot compute a
 * color, so this pins the source: no `isDark`, no palette pick, no literal
 * color, in the files the turn renders.
 */

import { readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC = join(dirname(fileURLToPath(import.meta.url)), "..");
const AGENT_QA = join(SRC, "features", "agentQA");

const turnFiles = (): string[] => {
    const own = [
        "AgentTurn.tsx",
        "AgentQAConversation.tsx",
        "ToolProgressList.tsx",
        "UndoControls.tsx",
        "ApprovalCard.tsx",
        "CitationLink.tsx",
        "markdownAnswerSx.ts",
    ].map((f) => join(AGENT_QA, f));
    const approval = readdirSync(join(AGENT_QA, "approval"))
        .filter((f) => f.endsWith(".tsx"))
        .map((f) => join(AGENT_QA, "approval", f));
    return [...own, ...approval];
};

const code = (path: string) =>
    readFileSync(path, "utf8")
        // comments may name what was removed
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/(^|[^:])\/\/.*$/gm, "$1")
        // A tag's / label's own default color is the user's data, not a theme color.
        .replace(/^const DEFAULT_(TAG|LABEL)_COLOR = .*$/gm, "");

describe("the answer turn reads tokens only", () => {
    const files = turnFiles();

    it("covers the turn, its steps, undo, approval card and every preview", () => {
        expect(files.length).toBeGreaterThanOrEqual(29);
    });

    it.each(files.map((f) => [f.slice(SRC.length + 1), f] as const))(
        "%s has no isDark, no palette pick and no DARK_TEXT constant",
        (_name, path) => {
            const src = code(path);
            expect(src).not.toMatch(/\bisDark\b/);
            expect(src).not.toMatch(/purplePalette/);
            expect(src).not.toMatch(/DARK_TEXT_/);
        }
    );

    it.each(files.map((f) => [f.slice(SRC.length + 1), f] as const))(
        "%s has no literal color",
        (_name, path) => {
            const src = code(path);
            expect(src).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
            expect(src).not.toMatch(/rgba?\(\s*\d/);
        }
    );
});

describe("Spotlight's own labels no longer define dark text colors", () => {
    it.each(["SpotlightContent.tsx", "SpotlightResultItem.tsx"])("%s", (f) => {
        const src = code(join(SRC, "features", "spotlight", f));
        expect(src).not.toMatch(/DARK_TEXT_/);
    });
    it("the shared module no longer exports them", () => {
        const idx = readFileSync(join(AGENT_QA, "index.ts"), "utf8");
        const sx = readFileSync(join(AGENT_QA, "markdownAnswerSx.ts"), "utf8");
        expect(idx).not.toMatch(/DARK_TEXT_/);
        expect(sx).not.toMatch(/export const DARK_TEXT_/);
    });
});
