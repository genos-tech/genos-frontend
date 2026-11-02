// The pure core of the agent-refine Yjs bridge: applying a
// server-persisted body to a note's collaborative fragment must be a
// DIFFED in-place update (what a live editor's binding produces for
// local edits), not a wipe-and-rewrite — concurrent editors merge
// against it like any CRDT race, and unchanged blocks keep their Yjs
// node identity/history. No network: the orchestrator around this core
// only adds provider connect/flush (covered below with a fake provider
// and, end to end, in the manual verification path).
//
// The conversion needs the note editors' schema (MIP-949): bodies carry
// `@` mention and `#` reference chips and alert blocks, which the
// default BlockNote schema cannot convert.

// Read back through the module's own schema holder: reading needs the
// same schema the writer used.
import { yXmlFragmentToBlocks } from "@blocknote/core/yjs";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import {
    applyBlocksToFragment,
    getSchemaHolder,
    noteDocumentName,
} from "../features/notes/common/services/applyNoteBodyToYjs";

const readBlocks = (fragment: Y.XmlFragment) =>
    yXmlFragmentToBlocks(getSchemaHolder(), fragment).map((b) => ({
        type: b.type,
        text: (b.content as Array<{ text?: string }> | undefined)?.map((c) => c.text).join(""),
    }));

/** The blocks as the editor would read them back, ids and children
 * stripped so a test can compare against what it wrote. */
const readFull = (fragment: Y.XmlFragment) =>
    yXmlFragmentToBlocks(getSchemaHolder(), fragment).map((b) => {
        const { id: _id, children: _children, ...rest } = b as unknown as Record<string, unknown>;
        void _id;
        void _children;
        return rest;
    });

const para = (text: string) => ({
    type: "paragraph",
    content: [{ type: "text", text, styles: {} }],
});

const heading = (text: string, level: number) => ({
    type: "heading",
    props: { level },
    content: [{ type: "text", text, styles: {} }],
});

describe("applyBlocksToFragment", () => {
    it("populates an empty fragment (never-opened note)", () => {
        const doc = new Y.Doc();
        const frag = doc.getXmlFragment("document-store");
        applyBlocksToFragment([heading("Goal", 3), para("Ship it")], frag);
        expect(readBlocks(frag)).toEqual([
            { type: "heading", text: "Goal" },
            { type: "paragraph", text: "Ship it" },
        ]);
    });

    it("replaces existing content in place (refine)", () => {
        const doc = new Y.Doc();
        const frag = doc.getXmlFragment("document-store");
        applyBlocksToFragment([para("old draft"), para("scratch")], frag);
        applyBlocksToFragment([heading("Rewritten", 3), para("better structure")], frag);
        expect(readBlocks(frag)).toEqual([
            { type: "heading", text: "Rewritten" },
            { type: "paragraph", text: "better structure" },
        ]);
    });

    it("diffs rather than wipes: an unchanged leading block keeps its Yjs node", () => {
        const doc = new Y.Doc();
        const frag = doc.getXmlFragment("document-store");
        applyBlocksToFragment([para("intro stays"), para("old ending")], frag);
        const firstNodeBefore = frag.get(0);
        applyBlocksToFragment([para("intro stays"), para("new ending")], frag);
        // Same Y node instance for the untouched block — a rehydration
        // would have replaced every node (and destroyed history).
        expect(frag.get(0)).toBe(firstNodeBefore);
        expect(readBlocks(frag)[1]).toEqual({ type: "paragraph", text: "new ending" });
    });

    it("an empty body becomes a single empty paragraph (PM requires one block)", () => {
        const doc = new Y.Doc();
        const frag = doc.getXmlFragment("document-store");
        applyBlocksToFragment([para("something")], frag);
        applyBlocksToFragment([], frag);
        const blocks = readBlocks(frag);
        expect(blocks).toHaveLength(1);
        expect(blocks[0].type).toBe("paragraph");
        expect(blocks[0].text ?? "").toBe("");
    });
});

// A body as the agent's `update_note` stores it (genos-api's
// `markdown_to_blocks` plus the `@` / `#` chips of MIP-708): every prop a
// string, `props: {}` and `children: []` spelled out.
const chip = (type: string, props: Record<string, string>) => ({ type, props });
const text = (value: string, styles: Record<string, boolean> = {}) => ({
    type: "text",
    text: value,
    styles,
});

const mention = chip("mention", { userId: "u-7", userName: "Alice" });
const hashTask = chip("hashTask", {
    projectId: "12",
    taskId: "345",
    displayId: "GEN-42",
    title: "Fix login",
});
const hashNote = chip("hashNote", {
    noteKind: "task",
    noteId: "9",
    title: "Retro notes",
    projectId: "12",
    taskId: "345",
});
const mentionGroup = chip("mentionGroup", { groupId: "3", groupName: "Design", memberCount: "4" });
const hashChat = chip("hashChat", { chatId: "88", chatName: "launch" });
const hashProject = chip("hashProject", { projectId: "12", projectName: "Genos" });
const customEmoji = chip("customEmoji", { name: "party", url: "https://x.test/party.png" });

const inlineOf = (fragment: Y.XmlFragment, blockIndex: number) =>
    (readFull(fragment)[blockIndex] as { content: Array<Record<string, unknown>> }).content;

// MIP-949. The default BlockNote schema throws on every one of these
// ("node type mention not found in schema"; for the alert block "Cannot
// read properties of undefined (reading 'isInGroup')"), so an approved
// agent edit with a chip or an alert could not be applied from the browser.
describe("applyBlocksToFragment: chips and alerts (MIP-949)", () => {
    it.each([
        ["mention", mention],
        ["hashTask", hashTask],
        ["hashNote", hashNote],
        ["mentionGroup", mentionGroup],
        ["hashChat", hashChat],
        ["hashProject", hashProject],
        ["customEmoji", customEmoji],
    ])("converts a %s chip and keeps every prop", (type, node) => {
        const frag = new Y.Doc().getXmlFragment("document-store");
        expect(() =>
            applyBlocksToFragment(
                [
                    {
                        type: "paragraph",
                        props: {},
                        content: [text("see "), node, text(" now")],
                        children: [],
                    },
                ],
                frag
            )
        ).not.toThrow();
        const content = inlineOf(frag, 0);
        expect(content.map((c) => c.type)).toEqual(["text", type, "text"]);
        expect(content[1]).toMatchObject({ type, props: node.props });
    });

    it("keeps a hashTask's id-only label mode and a hashNote's defaults", () => {
        const frag = new Y.Doc().getXmlFragment("document-store");
        applyBlocksToFragment(
            [
                {
                    type: "paragraph",
                    content: [chip("hashTask", { displayId: "GEN-1", labelMode: "id" }), hashNote],
                },
            ],
            frag
        );
        const [task, note] = inlineOf(frag, 0) as Array<{ props: Record<string, string> }>;
        expect(task.props.labelMode).toBe("id");
        // Props the writer left out read back as the editor's defaults.
        expect(task.props.title).toBe("");
        expect(note.props).toMatchObject({ chatType: "", chatId: "", threadId: "0" });
    });

    it("converts an alert block, keeps its type and text, and a chip inside it", () => {
        const frag = new Y.Doc().getXmlFragment("document-store");
        expect(() =>
            applyBlocksToFragment(
                [
                    para("before"),
                    {
                        type: "alert",
                        props: { type: "info" },
                        content: [text("Heads up "), mention],
                        children: [],
                    },
                ],
                frag
            )
        ).not.toThrow();
        const blocks = readFull(frag) as Array<{
            type: string;
            props: Record<string, string>;
            content: Array<Record<string, unknown>>;
        }>;
        expect(blocks.map((b) => b.type)).toEqual(["paragraph", "alert"]);
        expect(blocks[1].props.type).toBe("info");
        expect(blocks[1].content.map((c) => c.type)).toEqual(["text", "mention"]);
        expect(blocks[1].content[1]).toMatchObject({ props: mention.props });
    });

    it("an alert written without a type reads back as the editor's default (warning)", () => {
        const frag = new Y.Doc().getXmlFragment("document-store");
        applyBlocksToFragment([{ type: "alert", content: [text("x")] }], frag);
        expect((readFull(frag)[0] as { props: Record<string, string> }).props.type).toBe(
            "warning"
        );
    });

    it("converts chips inside a heading, a list item and a nested child", () => {
        const frag = new Y.Doc().getXmlFragment("document-store");
        applyBlocksToFragment(
            [
                { type: "heading", props: { level: 2 }, content: [hashProject] },
                {
                    type: "bulletListItem",
                    content: [text("owner "), mention],
                    children: [{ type: "numberedListItem", content: [hashTask] }],
                },
            ],
            frag
        );
        const blocks = yXmlFragmentToBlocks(getSchemaHolder(), frag);
        expect(blocks).toHaveLength(2);
        expect((blocks[0].content as Array<{ type: string }>)[0].type).toBe("hashProject");
        expect((blocks[1].content as Array<{ type: string }>)[1].type).toBe("mention");
        expect(
            (blocks[1].children[0].content as Array<{ type: string; props: unknown }>)[0]
        ).toMatchObject({ type: "hashTask", props: hashTask.props });
    });

    it("replaces a body that had a chip with one that has a different chip, in place", () => {
        const frag = new Y.Doc().getXmlFragment("document-store");
        applyBlocksToFragment(
            [para("intro stays"), { type: "paragraph", content: [mention] }],
            frag
        );
        const intro = frag.get(0);
        applyBlocksToFragment(
            [para("intro stays"), { type: "paragraph", content: [hashTask] }],
            frag
        );
        expect(frag.get(0)).toBe(intro);
        expect(inlineOf(frag, 1).map((c) => c.type)).toEqual(["hashTask"]);
    });

    it("applying the same chip and alert body again changes nothing (server push, then browser)", () => {
        // genos-api gives every block it writes an id (`markdown_to_blocks`),
        // which is what makes a second apply an empty diff; a block without
        // one is given a fresh random id by every conversion.
        const body = [
            { id: "b1", type: "heading", props: { level: 2 }, content: [text("Plan")] },
            {
                id: "b2",
                type: "paragraph",
                content: [text("cc "), mention, text(" on "), hashTask],
            },
            {
                id: "b3",
                type: "alert",
                props: { type: "success" },
                content: [text("ok"), hashNote],
            },
        ];
        // The server's push lands first ...
        const serverDoc = new Y.Doc();
        applyBlocksToFragment(body, serverDoc.getXmlFragment("document-store"));
        // ... then the browser syncs that state and applies the same body.
        const browserDoc = new Y.Doc();
        Y.applyUpdate(browserDoc, Y.encodeStateAsUpdate(serverDoc));
        const updates: Uint8Array[] = [];
        browserDoc.on("update", (u: Uint8Array) => updates.push(u));
        applyBlocksToFragment(body, browserDoc.getXmlFragment("document-store"));
        expect(updates).toHaveLength(0);
    });

    it("still throws, rather than half-writing, on a type no schema knows", () => {
        const frag = new Y.Doc().getXmlFragment("document-store");
        expect(() =>
            applyBlocksToFragment([{ type: "paragraph", content: [{ type: "nope" }] }], frag)
        ).toThrow();
        expect(frag.length).toBe(0);
    });
});

// What converted fine under the default schema must still convert, to the
// same document, under the note editors' schema.
describe("applyBlocksToFragment: plain bodies still convert (regression)", () => {
    it("paragraph, headings, lists, bold, italic and a link", () => {
        const frag = new Y.Doc().getXmlFragment("document-store");
        applyBlocksToFragment(
            [
                { type: "heading", props: { level: 1 }, content: [text("Title")], children: [] },
                { type: "heading", props: { level: 3 }, content: [text("Sub")], children: [] },
                {
                    type: "paragraph",
                    props: {},
                    content: [
                        text("plain "),
                        text("bold", { bold: true }),
                        text(" "),
                        text("italic", { italic: true }),
                        text(" "),
                        { type: "link", href: "https://example.com", content: [text("site")] },
                    ],
                    children: [],
                },
                { type: "bulletListItem", props: {}, content: [text("one")], children: [] },
                { type: "numberedListItem", props: {}, content: [text("two")], children: [] },
                { type: "checkListItem", props: { checked: true }, content: [text("done")] },
            ],
            frag
        );
        const blocks = yXmlFragmentToBlocks(getSchemaHolder(), frag);
        expect(blocks.map((b) => b.type)).toEqual([
            "heading",
            "heading",
            "paragraph",
            "bulletListItem",
            "numberedListItem",
            "checkListItem",
        ]);
        expect(blocks[1].props).toMatchObject({ level: 3 });
        const para = blocks[2].content as Array<Record<string, unknown>>;
        expect(para.map((c) => c.type)).toEqual(["text", "text", "text", "text", "text", "link"]);
        expect(para[1]).toMatchObject({ text: "bold", styles: { bold: true } });
        expect(para[3]).toMatchObject({ text: "italic", styles: { italic: true } });
        expect(para[5]).toMatchObject({ type: "link", href: "https://example.com" });
        expect(blocks[5].props).toMatchObject({ checked: true });
    });

    it("quote, a code block with its language, and a divider", () => {
        const frag = new Y.Doc().getXmlFragment("document-store");
        applyBlocksToFragment(
            [
                { type: "quote", props: {}, content: [text("wise")], children: [] },
                {
                    type: "codeBlock",
                    props: { language: "python" },
                    content: [text("print(1)")],
                    children: [],
                },
                { type: "divider", props: {}, children: [] },
            ],
            frag
        );
        const blocks = yXmlFragmentToBlocks(getSchemaHolder(), frag);
        expect(blocks.map((b) => b.type)).toEqual(["quote", "codeBlock", "divider"]);
        expect(blocks[1].props).toMatchObject({ language: "python" });
    });
});

// The editors' room names; genos-collab and genos-api use the same three.
describe("noteDocumentName", () => {
    it.each([
        ["personal", "my-note:7"],
        ["task", "task-note:7"],
        ["chat", "chat-note:7"],
    ] as const)("%s notes live in %s", (type, name) => {
        expect(noteDocumentName(type, 7)).toBe(name);
    });
});
