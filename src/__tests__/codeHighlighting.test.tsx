/**
 * MIP-1604: code blocks are coloured.
 *
 * `@blocknote/code-block` ships a Shiki highlighter (JavaScript regex engine, one precompiled
 * grammar per language) but nothing registered it, so every code block was plain white on grey.
 * `useGenosEditor` and the collaborative editors now add `syntaxHighlighter`; BlockNote creates
 * the highlighter and loads a language's grammar only when it parses a block of that language,
 * and re-highlights only the block that changed.
 *
 * Real editors, mounted in jsdom, with the real grammars: a block is coloured when its tokens
 * carry Shiki's colour variables (`--shiki-light` / `--shiki-dark`).
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { en } from "@blocknote/core/locales";
import { renderHook, waitFor } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import {
    createGenosSchema,
    createLegacyMentionSpecs,
    type GenosMentionContext,
} from "../components/editors/genos/genosSchema";
import {
    GENOS_SURFACES,
    useGenosEditor,
    type GenosSurface,
} from "../components/editors/genos/useGenosEditor";

const ctx: GenosMentionContext = {
    teamMemberProfiles: {},
    socket: null,
    myself: {} as never,
    setMyself: () => {},
    useUISM: {} as never,
    useCM: {} as never,
};
const code = (language: string, text: string) => ({
    type: "codeBlock",
    props: { language },
    content: text,
});

const mountSurface = (surface: GenosSurface, blocks: unknown[]) => {
    const { result } = renderHook(() =>
        useGenosEditor({
            surface,
            schema: createGenosSchema(createLegacyMentionSpecs(ctx)),
            dictionary: en as never,
            initialContent: blocks as never,
        })
    );
    const host = document.body.appendChild(document.createElement("div"));
    result.current.mount(host);
    return host;
};
/** The coloured tokens of the n-th code block. */
const coloured = (host: HTMLElement, n = 0) =>
    [
        ...host.querySelectorAll('[data-content-type="codeBlock"]')[n].querySelectorAll("span"),
    ].filter((s) => /--shiki-/.test(s.getAttribute("style") ?? ""));

describe.each(Object.keys(GENOS_SURFACES) as GenosSurface[])("the %s editor", (surface) => {
    it("colours a code block in a language it has a grammar for", async () => {
        const host = mountSurface(surface, [code("typescript", "const a: number = 1; // note")]);
        // Nothing is coloured before the highlighter and the grammar have loaded...
        await waitFor(() => expect(coloured(host).length).toBeGreaterThan(2), { timeout: 20000 });
        // ...and the code itself is unchanged.
        expect(host.querySelector('[data-content-type="codeBlock"]')?.textContent).toContain(
            "const a: number = 1; // note"
        );
    }, 30000);

    it("colours a block that still carries a language alias (`ts`), as that language", async () => {
        const host = mountSurface(surface, [code("ts", "const a: number = 1;")]);
        await waitFor(() => expect(coloured(host).length).toBeGreaterThan(2), { timeout: 20000 });
    }, 30000);

    it("leaves plain text and a language with no grammar alone", async () => {
        const host = mountSurface(surface, [
            code("text", "const a = 1;"),
            code("go", "func main() {}"),
            code("typescript", "const b = 2;"),
        ]);
        // The typescript block (last) is the signal that highlighting has run.
        await waitFor(() => expect(coloured(host, 2).length).toBeGreaterThan(1), {
            timeout: 20000,
        });
        expect(coloured(host, 0)).toHaveLength(0);
        expect(coloured(host, 1)).toHaveLength(0);
    }, 30000);
});

// ---------------------------------------------------------------------------------------------
// The chunking that keeps the colours free. Shiki's grammars used to be pinned into
// `vendor-editor` (3.4 MB raw, every note opened with all of them); the build now makes each one
// a chunk of its own. `scripts/bundleGuard.ts` fails the build if that regresses; these two pin
// the rule in the config and the guard in the script, so neither can be dropped quietly.
// ---------------------------------------------------------------------------------------------
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
describe("lazy grammars", () => {
    it("the manualChunks rule leaves grammars and themes unpinned, before the vendor-editor rule", () => {
        const config = readFileSync(resolve(root, "vite.config.ts"), "utf8");
        const unpinned = config.indexOf('id.includes("@shikijs/langs-precompiled")');
        const pinned = config.indexOf('id.includes("@shikijs")');
        expect(unpinned).toBeGreaterThan(-1);
        expect(config).toMatch(/@shikijs\/themes"\)\s*\)\s*\{\s*return undefined;/);
        expect(unpinned).toBeLessThan(pinned);
    });

    it("the bundle guard fails the build when a grammar lands in a lazy vendor chunk", () => {
        const guard = readFileSync(resolve(root, "scripts/bundleGuard.ts"), "utf8");
        expect(guard).toContain("langs-precompiled|themes");
        expect(guard).toMatch(/Shiki grammars\/themes are pinned into a vendor chunk/);
    });
});
