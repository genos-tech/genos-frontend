// The pure core of the agent-refine Yjs bridge: applying a
// server-persisted body to a note's collaborative fragment must be a
// DIFFED in-place update (what a live editor's binding produces for
// local edits), not a wipe-and-rewrite — concurrent editors merge
// against it like any CRDT race, and unchanged blocks keep their Yjs
// node identity/history. No network: the orchestrator around this core
// only adds provider connect/flush, which is exercised end-to-end in
// the manual verification path.

// Read back through a throwaway doc-independent editor by reusing the
// module's own schema holder via a second apply→read cycle: reading
// needs the same schema the writer used, so we import the reader from
// the same module boundary the production code uses.
import { BlockNoteEditor } from "@blocknote/core";
import { yXmlFragmentToBlocks } from "@blocknote/core/yjs";
import { describe, expect, it } from "vitest";
import * as Y from "yjs";

import { applyBlocksToFragment } from "../features/notes/common/services/applyNoteBodyToYjs";

const readBlocks = (fragment: Y.XmlFragment) =>
    yXmlFragmentToBlocks(reader, fragment).map((b) => ({
        type: b.type,
        text: (b.content as Array<{ text?: string }> | undefined)?.map((c) => c.text).join(""),
    }));

const reader = BlockNoteEditor.create({ initialContent: [{ type: "paragraph" }] });

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
