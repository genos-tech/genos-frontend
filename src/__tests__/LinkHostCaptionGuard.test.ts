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

// Where an editor is created. Since MIP-1131 that is a few places: the two Genos hooks (the
// local one takes a `surface`, the collaborative one is for the documents), and the collaborative
// hook, which receives its extensions from `useGenosCollabEditor`. Every wrapper goes through one
// of the Genos hooks. Since MIP-1161 the seven chat-style composers (chat, thread, task comment,
// v3 and the three edit-in-place ones) create theirs in ONE place, `useChatComposer`, on the
// `composer` surface; `COMPOSERS` below pins that none of them creates its own again.
const CREATES_AN_EDITOR =
    /\buseCreateBlockNote\(|\buseCollaborativeBlockNote\(\{|\buseGenosEditor\(\{/;
const HOOK_ITSELF = "hooks/common/useCollaborativeBlockNote.ts";
const GENOS_HOOKS = "components/editors/genos/useGenosEditor.ts";
const COMPOSER_HOOK = "components/editors/composer/useChatComposer.ts";
const COMPOSERS = [
    "components/editors/bnChatEditor.tsx",
    "components/editors/bnThreadEditor.tsx",
    "components/editors/bnTaskCommentEditor.tsx",
    "components/editors/bnUpdateEditor.tsx",
    "components/editors/bnUpdateThreadEditor.tsx",
    "components/editors/bnUpdateTaskCommentEditor.tsx",
    "features/channel/components/MessageComposerV3.tsx",
];

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

/** The surfaces that skip the editing rules (and so the link caption): read-only ones. */
const surfacesWithoutEditingRules = (hooks: string): string[] => {
    const table = hooks.slice(hooks.indexOf("GENOS_SURFACES = {"), hooks.indexOf("} as const;"));
    return [...table.matchAll(/^\s+(\w+):\s*\{\s*editingRules:\s*false/gm)].map((m) => m[1]);
};

describe("link host caption in every editable editor", () => {
    it("finds the editors (so the scan can't pass by finding none)", () => {
        // The composer hook (all 7 composers), the template and todo bodies and the read-only
        // chat preview (all through useGenosEditor), and the Genos hooks file. The 4 collab
        // wrappers go through useGenosCollabEditor.
        expect(editorFiles.length).toBeGreaterThanOrEqual(5);
        expect(editorFiles.map(({ file }) => file)).toContain(COMPOSER_HOOK);
    });

    it.each(COMPOSERS)("%s gets its editor from the shared composer hook", (file) => {
        const text = withoutComments(readFileSync(join(SRC, file), "utf8"));
        expect(text, `${file} calls useChatComposer`).toMatch(/\buseChatComposer\b[<(]/);
        expect(text, `${file} does not create an editor itself`).not.toMatch(CREATES_AN_EDITOR);
    });

    it.each(
        editorFiles
            .filter(({ file }) => file !== GENOS_HOOKS)
            .map(({ file, text }) => [file, text] as const)
    )("%s registers it unless it is read-only", (file, text) => {
        const readOnly = /editable=\{false\}/.test(text);
        if (readOnly) return;

        // A wrapper on `useGenosEditor` gets it from the surface (checked below).
        if (/\buseGenosEditor\(/.test(text)) {
            expect(text, `${file} names a surface`).toMatch(
                /surface:\s*"(composer|todo|template)"/
            );
            return;
        }
        expect(text, `${file} creates an editable editor`).toMatch(
            /extensions:\s*\[[^\]]*\blinkHostCaption\b[^\]]*\]/
        );
    });

    it("the Genos hooks register it for every editing surface and for the collab editors", () => {
        const hooks = readFileSync(join(SRC, GENOS_HOOKS), "utf8");
        // local editors: inside the `editingRules` branch
        expect(hooks).toMatch(
            /cfg\.editingRules[\s\S]*extensions:\s*\[[\s\S]*\blinkHostCaption\b/
        );
        // collaborative editors
        expect(hooks).toMatch(/extensions:\s*\[codeFenceInputRule,\s*linkHostCaption\]/);
    });

    it("leaves exactly the read-only previews out", () => {
        const readOnly = editorFiles
            .filter(({ text }) => /editable=\{false\}/.test(text))
            .map(({ file }) => file);
        expect(readOnly).toEqual(["components/editors/bnChatPreview.tsx"]);

        // ...and the only surface without editing rules is the one that preview uses.
        const hooks = readFileSync(join(SRC, GENOS_HOOKS), "utf8");
        expect(surfacesWithoutEditingRules(hooks)).toEqual(["preview"]);
        const users = editorFiles
            .filter(({ text }) => /surface:\s*"preview"/.test(text))
            .map(({ file }) => file);
        expect(users).toEqual(["components/editors/bnChatPreview.tsx"]);
    });
});
