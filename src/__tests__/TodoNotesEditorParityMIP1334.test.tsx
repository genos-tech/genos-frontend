/**
 * MIP-1334: a to-do's notes are edited like a task body, without media.
 *
 * The notes editor (`BnTodoPreview`) had the `/` menu, the drag handle, the link toolbar and
 * table handles switched off and hid headings and quotes. It now mounts the task body's tools.
 * Media is left out on purpose: a to-do has nowhere to upload a file to, so the `/` menu's
 * `todo` preset drops image, video, audio, file and GIF, and the toolbar drops its GIF button.
 *
 * The `/` items are asserted on a real (headless) editor. The view's wiring is asserted on the
 * source, as the other editor guards do: jsdom can't drive BlockNote's floating menus.
 */
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it, vi } from "vitest";

import { genosSlashItems, MEDIA_SLASH_KEYS } from "../components/editors/genos/genosSlashItems";
import { GENOS_SURFACES } from "../components/editors/genos/useGenosEditor";
import { createHeadlessNoteSchema } from "../components/editors/headlessNoteSchema";

const srcDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const code = (path: string) =>
    readFileSync(resolve(srcDir, path), "utf8")
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");

const editor = () => BlockNoteEditor.create({ schema: createHeadlessNoteSchema() });
const keysOf = (preset: "todo" | "document" | "chat") =>
    genosSlashItems(preset, editor(), vi.fn()).map(
        (item) => (item as { key?: string }).key ?? item.title
    );
const GIF = (titles: string[]) => titles.some((t) => /gif/i.test(t));

describe("the to-do notes `/` menu", () => {
    it("offers no media: no image, video, audio, file or GIF", () => {
        const keys = keysOf("todo");
        for (const media of MEDIA_SLASH_KEYS) expect(keys).not.toContain(media);
        expect(GIF(keys)).toBe(false);
    });

    it("offers what a task body offers otherwise: headings, lists, quote, code, table, math", () => {
        const keys = keysOf("todo");
        for (const k of [
            "heading",
            "bullet_list",
            "numbered_list",
            "check_list",
            "quote",
            "code_block",
            "table",
            "divider",
        ]) {
            expect(keys).toContain(k);
        }
        // Everything else is the task body's menu, item for item, the math and diagram blocks
        // included.
        const document = keysOf("document").filter((k) => !MEDIA_SLASH_KEYS.has(k) && !GIF([k]));
        expect(keys).toEqual(document);
    });

    it("leaves the task body's menu as it was (media and GIF still there)", () => {
        // (The notes schema has no audio or video blocks, so those two never appear.)
        const keys = keysOf("document");
        expect(keys).toContain("image");
        expect(keys).toContain("file");
        expect(GIF(keys)).toBe(true);
    });
});

describe("the to-do notes editor", () => {
    const view = code("components/editors/bnTodoPreview.tsx");

    it("mounts the drag handle (side menu) and the `todo` slash preset", () => {
        expect(view).toMatch(/<SideMenuController[\s\S]*dragHandleMenu=\{CustomDragHandleMenu\}/);
        expect(view).toMatch(/slash=\{\{\s*preset:\s*"todo"/);
        // The built-in ones stay off so ours are the only ones (two menus on "/" otherwise).
        expect(view).toMatch(/slashMenu=\{false\}/);
        expect(view).toMatch(/sideMenu=\{false\}/);
    });

    it("keeps the link toolbar and table handles (no longer switched off)", () => {
        expect(view).not.toMatch(/linkToolbar=\{false\}/);
        expect(view).not.toMatch(/tableHandles=\{false\}/);
    });

    it("uses the document toolbar without media, so headings and quotes are offered", () => {
        expect(view).toMatch(/<GenosDocumentToolbar[\s\S]*?media=\{false\}/);
        expect(view).not.toMatch(/HIDDEN_BLOCK_TYPES/);
    });

    it("creates its editor with tables on", () => {
        expect(GENOS_SURFACES.todo.tables).toBe(true);
    });

    it("the document toolbar hides the GIF button only when told to", () => {
        const toolbar = code("components/editors/genos/GenosToolbars.tsx");
        expect(toolbar).toMatch(/media = true/);
        expect(toolbar).toMatch(/\{media && \(\s*<GifToolbarButton/);
    });
});
