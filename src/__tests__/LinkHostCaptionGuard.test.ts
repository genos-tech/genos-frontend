/**
 * Every editable BlockNote editor registers `linkHostCaption` (MIP-990).
 *
 * An editable editor gets its link captions from that extension, because the
 * document-level labeller must not write into an editable editor (ProseMirror
 * redraws what it didn't write, in a loop). An editor that forgets it shows no
 * host after its links: safe, but it silently loses the MIP-737 protection that
 * shows where a pasted or agent-written link really goes.
 *
 * Source-scanned, like the custom-emoji schema guard: add an editor and forget
 * the extension, and this fails. A read-only editor (`editable={false}`) is
 * labelled by the labeller and is left out on purpose.
 */

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

const SRC = join(__dirname, "..");

const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
            return name === "__tests__" || name === "node_modules" ? [] : sources(path);
        }
        return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });

// Where an editor is created. The collaborative hook is not one: it receives
// its extensions from the four editors that call it.
const CREATES_AN_EDITOR = /\buseCreateBlockNote\(|\buseCollaborativeBlockNote\(\{/;
const HOOK_ITSELF = "hooks/common/useCollaborativeBlockNote.ts";

// Comment lines are not code: a comment that names `useCreateBlockNote(` is not an editor.
const withoutComments = (text: string) =>
    text
        .split("\n")
        .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
        .join("\n");

const editorFiles = sources(SRC)
    .map((path) => ({
        file: relative(SRC, path),
        text: withoutComments(readFileSync(path, "utf8")),
    }))
    .filter(({ file, text }) => file !== HOOK_ITSELF && CREATES_AN_EDITOR.test(text));

describe("link host caption in every editable editor", () => {
    it("finds the editors (so the scan can't pass by finding none)", () => {
        // 12 editors with an extensions list, the v3 composer, and the read-only chat preview.
        expect(editorFiles.length).toBeGreaterThanOrEqual(14);
    });

    it.each(editorFiles.map(({ file, text }) => [file, text] as const))(
        "%s registers it unless it is read-only",
        (file, text) => {
            const readOnly = /editable=\{false\}/.test(text);
            if (readOnly) return;

            expect(text, `${file} creates an editable editor`).toMatch(
                /extensions:\s*\[[^\]]*\blinkHostCaption\b[^\]]*\]/
            );
        }
    );

    it("leaves exactly the read-only previews out", () => {
        const readOnly = editorFiles
            .filter(({ text }) => /editable=\{false\}/.test(text))
            .map(({ file }) => file);

        expect(readOnly).toEqual(["components/editors/bnChatPreview.tsx"]);
    });
});
