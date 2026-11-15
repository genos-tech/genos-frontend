/**
 * MIP-1604: a body that reaches an editor from outside it must never be rejected whole.
 *
 * MIP-1601 made the collab seed, the Yjs writer and the restore path degrade a block the schema
 * cannot build. The editors that take a body as `initialContent` (the chat and thread
 * composers and their edit-in-place twins, a chat message bubble, the to-do notes, the project
 * body template, and the note editors when there is no collab server) went straight to
 * BlockNote, whose constructor throws "Error creating document from blocks passed as
 * `initialContent`" for ONE bad block: the component crashed, so a message with a bad block
 * took the page's error boundary with it. The `replaceBlocks` entry points that feed stored
 * blocks (a saved draft, an edited message, a failed-send restore, a template) had the same
 * hole behind a `catch` that threw the whole body away.
 *
 * Real editors throughout: the failing case is asserted first, then the fix.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { BlockNoteEditor } from "@blocknote/core";
import { en } from "@blocknote/core/locales";
import { renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

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
import { createHeadlessNoteSchema } from "../components/editors/headlessNoteSchema";
import { blockPlainText, replaceBlocksSafely } from "../components/editors/safeBlocks";
import { useCollaborativeBlockNote } from "../hooks/common/useCollaborativeBlockNote";
import { useEditorDraft } from "../hooks/common/useEditorDraft";
import { readDraft, writeDraft } from "../utils/editorDraftStorage";

vi.mock("../db/utils/yjsPersistence", () => ({
    createYjsPersistence: () => ({}),
    destroyYjsPersistence: () => Promise.resolve(),
}));

const ctx: GenosMentionContext = {
    teamMemberProfiles: {},
    socket: null,
    myself: {} as never,
    setMyself: () => {},
    useUISM: {} as never,
    useCM: {} as never,
};
const schema = () => createGenosSchema(createLegacyMentionSpecs(ctx));
const p = (content: string) => ({ type: "paragraph", content });

// Blocks BlockNote's own conversion rejects (the same families as safeBlocks.test.ts).
const BAD: Record<string, [unknown, string | null]> = {
    "an unknown block type": [{ type: "fancy", content: "fancy text" }, "fancy text"],
    "an unknown inline type": [
        { type: "paragraph", content: [{ type: "weird", text: "kept words" }] },
        "kept words",
    ],
    "a style with no spec": [
        { type: "paragraph", content: [{ type: "text", text: "styled", styles: { nope: true } }] },
        "styled",
    ],
    "a table with no rows": [{ type: "table", content: { type: "tableContent", rows: [] } }, null],
    "a null block": [null, null],
};
const body = (bad: unknown) => [p("first"), bad, p("last")];
const textOf = (editor: { document: unknown[] }) =>
    editor.document.map((b) => blockPlainText(b)).filter((t) => t !== "");
const expected = (kept: string | null) =>
    kept === null ? ["first", "last"] : ["first", kept, "last"];

beforeEach(() => {
    window.localStorage.clear();
    vi.spyOn(console, "warn").mockImplementation(() => {});
});
afterEach(() => {
    vi.restoreAllMocks();
});

describe.each(Object.entries(BAD))("%s as `initialContent`", (_name, [bad, kept]) => {
    it("is what BlockNote itself rejects (what this fixes)", () => {
        expect(() =>
            BlockNoteEditor.create({ schema: schema(), initialContent: body(bad) } as never)
        ).toThrow(/initialContent/);
    });

    it.each(Object.keys(GENOS_SURFACES) as GenosSurface[])(
        "the %s editor opens, keeping the rest of the body",
        (surface) => {
            const { result } = renderHook(() =>
                useGenosEditor({
                    surface,
                    schema: schema(),
                    dictionary: en as never,
                    initialContent: body(bad) as never,
                })
            );
            expect(textOf(result.current as never)).toEqual(expected(kept));
        }
    );

    it("the note editors open without a collab server (no provider), keeping the body", () => {
        const { result } = renderHook(() =>
            useCollaborativeBlockNote({
                documentName: "my-note:1",
                user: { name: "Me", color: "#112233" },
                userId: "u1",
                myself: { userId: "u1" } as never,
                accessToken: null,
                schema: createHeadlessNoteSchema() as never,
                dictionary: en as never,
                initialBody: body(bad),
            })
        );
        expect(result.current.provider).toBeNull();
        expect(textOf(result.current.editor as never)).toEqual(expected(kept));
    });

    it("`replaceBlocksSafely` puts the rest of the body in a live editor", () => {
        const editor = BlockNoteEditor.create({ schema: schema() } as never) as never as {
            document: unknown[];
            replaceBlocks: (a: unknown, b: unknown) => void;
        };
        expect(() => editor.replaceBlocks(editor.document, body(bad))).toThrow();
        replaceBlocksSafely(editor as never, body(bad), "a test");
        expect(textOf(editor)).toEqual(expected(kept));
    });

    it("a saved draft that carries it is restored, not thrown away", () => {
        writeDraft("chat:1", body(bad));
        const editor = BlockNoteEditor.create({ schema: schema() } as never);
        renderHook(() => useEditorDraft(editor, "chat:1"));
        expect(textOf(editor as never)).toEqual(expected(kept));
        // The draft is still stored: nothing was discarded.
        expect(readDraft("chat:1")).not.toBeNull();
    });
});

describe("a body that is fine", () => {
    it("is handed to the editor as it came (same blocks, no extra work visible)", () => {
        const good = [p("a"), { type: "bulletListItem", content: "b" }, p("c")];
        const { result } = renderHook(() =>
            useGenosEditor({
                surface: "preview",
                schema: schema(),
                dictionary: en as never,
                initialContent: good as never,
            })
        );
        expect(textOf(result.current as never)).toEqual(["a", "b", "c"]);
    });

    it("a body whose every block is bad still opens, as an empty editor", () => {
        const { result } = renderHook(() =>
            useGenosEditor({
                surface: "preview",
                schema: schema(),
                dictionary: en as never,
                initialContent: [
                    { type: "table", content: { type: "tableContent", rows: [] } },
                ] as never,
            })
        );
        expect(textOf(result.current as never)).toEqual([]);
    });

    it("an unknown code language in a chat message is resolved, not thrown on", () => {
        const { result } = renderHook(() =>
            useGenosEditor({
                surface: "preview",
                schema: schema(),
                dictionary: en as never,
                initialContent: [
                    { type: "codeBlock", props: { language: "ts" }, content: "let a = 1;" },
                ] as never,
            })
        );
        expect(
            (result.current.document[0] as { props: { language: string } }).props.language
        ).toBe("typescript");
    });
});

// ---------------------------------------------------------------------------------------------
// The guard: every `replaceBlocks` that is fed a body from somewhere else goes through
// `replaceBlocksSafely`. A call with a literal `[]` (clearing) or a literal block list built in
// place is fine; a variable is a stored or imported body.
// ---------------------------------------------------------------------------------------------
const SRC = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const sources = (dir: string): string[] =>
    readdirSync(dir).flatMap((name) => {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) return name === "__tests__" ? [] : sources(path);
        return /\.(ts|tsx)$/.test(name) && !/\.test\./.test(name) ? [path] : [];
    });

describe("replaceBlocks guard", () => {
    // The one place that calls it with a body is the helper itself, and the seed / restore code
    // that sanitises with the editor in hand (MIP-1601).
    const SANITISES_ITSELF = new Set([
        "components/editors/safeBlocks.ts",
        "components/editors/genos/GenosNoteEditor.tsx",
        "hooks/common/useCollaborativeBlockNote.ts",
    ]);
    const CALL = /\.replaceBlocks\(\s*([^,()]+(?:\([^()]*\))?[^,()]*),\s*([^;]*?)\)\s*;?\s*$/gm;

    it("no stored or imported body goes into replaceBlocks without being sanitised", () => {
        const offenders: string[] = [];
        for (const path of sources(SRC)) {
            const file = relative(SRC, path);
            if (SANITISES_ITSELF.has(file)) continue;
            const text = readFileSync(path, "utf8")
                .split("\n")
                .filter((line) => !/^\s*(\/\/|\*|\/\*)/.test(line))
                .join("\n");
            for (const m of text.matchAll(CALL)) {
                const arg = m[2].trim();
                if (arg === "[]") continue;
                offenders.push(`${file}: replaceBlocks(${m[1].trim()}, ${arg})`);
            }
        }
        expect(offenders).toEqual([]);
    });
});
