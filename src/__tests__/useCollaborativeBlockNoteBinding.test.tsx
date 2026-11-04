/**
 * The collaborative editors are really bound to the shared Yjs document (MIP-1009).
 *
 * Since BlockNote 0.52 the `collaboration` option is only honoured when the editor
 * options go through `withCollaboration`. `useCollaborativeBlockNote` hands its
 * options to `useCreateBlockNote` as `any`, so TypeScript cannot see a missing wrap,
 * and the other tests of this hook replace `useCreateBlockNote` with a stub, so none
 * of them builds a real editor: without the wrap every note and task body would
 * open, look fine, and never sync a keystroke.
 *
 * `useCreateBlockNote` is the one real BlockNote function this file swaps: the swap
 * builds a REAL editor from the options the hook passes (and mounts it), so the
 * hook's own code (its seeding, its resync, its repair of a document it cannot show)
 * runs against the editor the app would have. What is checked is the thing that
 * matters: what is typed lands in the Yjs document, what arrives in the Yjs document
 * shows up in the editor, and a stored body is seeded exactly once. The provider is a
 * stand-in with a real `Awareness`; the editor, the binding and the Yjs document are
 * the real ones.
 */

import { BlockNoteEditor } from "@blocknote/core";
import { CommentsExtension } from "@blocknote/core/comments";
import { en } from "@blocknote/core/locales";
import { blocksToYXmlFragment } from "@blocknote/core/yjs";
import { act, renderHook } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Awareness } from "y-protocols/awareness";
import * as Y from "yjs";

import {
    createHeadlessNoteEditor,
    createHeadlessNoteSchema,
} from "../components/editors/headlessNoteSchema";
import { useCollaborativeBlockNote } from "../hooks/common/useCollaborativeBlockNote";

type FakeProvider = { document: Y.Doc; awareness: Awareness };

const fakes = vi.hoisted(() => {
    // Read at module load by the hook; without it no provider is created.
    vi.stubEnv("VITE_COLLAB_URL", "ws://collab.test");
    return {
        providers: [] as unknown[],
        passed: [] as Record<string, unknown>[],
        created: [] as unknown[],
    };
});
const { providers, passed, created } = fakes;

vi.mock("@hocuspocus/provider", async () => {
    const { Awareness: RealAwareness } = await import("y-protocols/awareness");
    return {
        HocuspocusProvider: class {
            document: Y.Doc;
            awareness: Awareness;
            configuration: Record<string, unknown>;
            authorizedScope = "read-write";
            connect = vi.fn(() => Promise.resolve());
            destroy = vi.fn();
            on = vi.fn();
            off = vi.fn();
            constructor(configuration: { document: Y.Doc }) {
                this.document = configuration.document;
                this.awareness = new RealAwareness(configuration.document);
                this.configuration = {
                    ...configuration,
                    websocketProvider: { disconnect: vi.fn() },
                };
                providers.push(this);
            }
        },
    };
});
// The hook builds its editor with BlockNote's `useCreateBlockNote`; hand it back the options
// it was given so a real editor can be built from them below.
vi.mock("@blocknote/react", async () => {
    const { BlockNoteEditor: Real } = await import("@blocknote/core");
    const built = new WeakMap<object, unknown>();
    return {
        useCreateBlockNote: (options: Record<string, unknown>) => {
            passed.push(options);
            // One editor per options object, as the real hook keeps one per dependency set.
            if (!built.has(options)) {
                const editor = Real.create(options as never);
                editor.mount(document.body.appendChild(document.createElement("div")));
                built.set(options, editor);
                created.push(editor);
            }
            return built.get(options);
        },
    };
});
vi.mock("../db/utils/yjsPersistence", () => ({
    createYjsPersistence: () => ({}),
    destroyYjsPersistence: () => Promise.resolve(),
}));

const FRAGMENT = "document-store";

const mountHook = (extra: Record<string, unknown> = {}) =>
    renderHook(() =>
        useCollaborativeBlockNote({
            documentName: "task-body:1",
            user: { name: "Editor", color: "#112233" },
            userId: "u-editor",
            myself: { userId: "u-editor" } as never,
            accessToken: "access-token",
            schema: createHeadlessNoteSchema() as never,
            dictionary: en as never,
            initialBody: [],
            ...extra,
        })
    );

/** The editor the hook built (real, mounted, bound to the provider's document). */
const realEditor = () => created.at(-1) as BlockNoteEditor<any, any, any>;

const textIn = (fragment: Y.XmlFragment) => fragment.toString();

beforeEach(() => {
    providers.length = 0;
    passed.length = 0;
    created.length = 0;
});
afterEach(() => {
    document.body.innerHTML = "";
});

describe("the editor the hook builds", () => {
    it("is handed a Yjs binding, and has BlockNote's own history switched off for it", () => {
        mountHook();

        const options = passed.at(-1)!;

        expect(options.collaboration).toBeDefined();
        expect(options.disableExtensions).toContain("history");
        // Our own extensions are kept, and the binding comes after them.
        expect(Array.isArray(options.extensions)).toBe(true);
        expect((options.extensions as unknown[]).length).toBeGreaterThan(1);
    });

    it("writes what is typed into the shared Yjs document", () => {
        mountHook();
        const { document: ydoc } = providers.at(-1) as FakeProvider;
        const editor = realEditor();

        editor.replaceBlocks(editor.document, [
            { id: "typed", type: "paragraph", content: "typed through the binding" },
        ] as never);

        expect(textIn(ydoc.getXmlFragment(FRAGMENT))).toContain("typed through the binding");
    });

    it("shows what arrives in the shared Yjs document", () => {
        mountHook();
        const { document: ydoc } = providers.at(-1) as FakeProvider;
        const editor = realEditor();

        // Another client's edit: a document built elsewhere, applied as an update.
        const remote = new Y.Doc();
        blocksToYXmlFragment(
            createHeadlessNoteEditor(),
            [{ id: "remote", type: "paragraph", content: "from another tab" }] as never,
            remote.getXmlFragment(FRAGMENT)
        );
        Y.applyUpdate(ydoc, Y.encodeStateAsUpdate(remote));

        const shown = JSON.stringify(editor.document);
        expect(shown).toContain("from another tab");
    });

    it("has the comments extension too when comments are on, bound to the same document", () => {
        mountHook({ enableComments: true });
        const withComments = (passed.at(-1)!.extensions as unknown[]).length;
        mountHook();
        const without = (passed.at(-1)!.extensions as unknown[]).length;
        mountHook({ enableComments: true });

        const editor = realEditor();

        expect(withComments).toBe(without + 1);
        expect(editor.getExtension(CommentsExtension)).toBeDefined();
    });

    it("keeps its own extensions working alongside the binding (Tab stays in the editor)", () => {
        mountHook();
        const options = passed.at(-1)!;

        // The hook adds `tabStaysInEditor` itself; it must still be in the list the
        // binding was appended to, not replaced by it.
        expect((options.extensions as unknown[]).length).toBeGreaterThanOrEqual(2);
        expect(options.tabBehavior).toBe("prefer-indent");
    });

    it("writes a stored body into an empty shared document exactly once, even if sync is reported twice", async () => {
        mountHook({ initialBody: [{ type: "paragraph", content: "the copy the REST api sent" }] });
        const provider = providers.at(-1) as {
            document: Y.Doc;
            configuration: { onSynced: (e: { state: boolean }) => void };
        };

        act(() => provider.configuration.onSynced({ state: true }));
        act(() => provider.configuration.onSynced({ state: true }));
        await new Promise((resolve) => setTimeout(resolve, 40));

        const xml = textIn(provider.document.getXmlFragment(FRAGMENT));
        expect(xml.split("the copy the REST api sent")).toHaveLength(2);
    });

    it("does not overwrite a shared document that already has a body with the stored copy", async () => {
        mountHook({ initialBody: [{ type: "paragraph", content: "the stale REST copy" }] });
        const provider = providers.at(-1) as {
            document: Y.Doc;
            configuration: { onSynced: (e: { state: boolean }) => void };
        };
        const server = new Y.Doc();
        blocksToYXmlFragment(
            createHeadlessNoteEditor(),
            [{ id: "s1", type: "paragraph", content: "the body the server already had" }] as never,
            server.getXmlFragment(FRAGMENT)
        );
        Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(server));

        act(() => provider.configuration.onSynced({ state: true }));
        await new Promise((resolve) => setTimeout(resolve, 40));

        const xml = textIn(provider.document.getXmlFragment(FRAGMENT));
        expect(xml).toContain("the body the server already had");
        expect(xml).not.toContain("the stale REST copy");
    });

    it("loads a document whose nested code block holds a styled character, and keeps the block", () => {
        // What an older BlockNote could save: a code block (inside a toggle list) with one coloured
        // character, pasted from an editor. BlockNote 0.52 made code blocks plain text, and
        // y-prosemirror's HEADLESS read (`yXmlFragmentToBlocks`) deletes an element it cannot build
        // from the document it reads: the compatibility check saw exactly that on one production
        // note (task note 13: its code block vanishes from that read). The LIVE editor binding, the
        // one the app runs, does not: it loads that note's real document intact, and a document
        // shaped like it here. If a later BlockNote or y-prosemirror starts deleting in the live
        // path, this fails before it reaches the shared document.
        mountHook();
        const provider = providers.at(-1) as FakeProvider;
        const editor = realEditor();

        const remote = new Y.Doc();
        blocksToYXmlFragment(
            createHeadlessNoteEditor(),
            [
                {
                    id: "t1",
                    type: "toggleListItem",
                    content: "a toggle",
                    children: [
                        {
                            id: "c1",
                            type: "codeBlock",
                            props: { language: "javascript" },
                            content: "const answer = 42;",
                        },
                    ],
                },
                { id: "p1", type: "paragraph", content: "after" },
            ] as never,
            remote.getXmlFragment(FRAGMENT)
        );
        const codeText = elementsNamed(remote.getXmlFragment(FRAGMENT), "codeBlock")[0]
            .toArray()
            .find((x) => x instanceof Y.XmlText) as Y.XmlText;
        codeText.format(6, 1, { textColor: { stringValue: "rgb(225, 228, 232)" } });
        Y.applyUpdate(provider.document, Y.encodeStateAsUpdate(remote));

        const shown = JSON.stringify(editor.document);
        expect(shown).toContain('"type":"codeBlock"');
        expect(shown).toContain("const answer = 42;");

        editor.updateBlock("p1", { content: "edited elsewhere" } as never);

        const fragment = provider.document.getXmlFragment(FRAGMENT);
        const plain = fragment.toString().replace(/<[^>]*>/g, "");
        expect(elementsNamed(fragment, "codeBlock")).toHaveLength(1);
        expect(plain).toContain("const answer = 42;");
    });
});

const elementsNamed = (node: Y.XmlFragment | Y.XmlElement, name: string): Y.XmlElement[] => {
    const found: Y.XmlElement[] = [];
    const visit = (x: unknown) => {
        if (x instanceof Y.XmlElement) {
            if (x.nodeName === name) found.push(x);
            x.toArray().forEach(visit);
        }
    };
    node.toArray().forEach(visit);
    return found;
};
