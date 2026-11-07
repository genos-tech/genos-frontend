/**
 * The Genos editor schema, checked at runtime (MIP-1131).
 *
 * Source scans (`BlockSpecsGuard`) fail when a new file builds a schema of its own; this
 * builds the real schemas and compares them. The rule it protects (MIP-1019): an editor
 * whose schema lacks a block or inline type DELETES it from the shared Yjs document, and a
 * body with a type the reader's schema lacks is rejected whole. So every surface that can
 * open a document has every type, and the headless schema (markdown / Yjs conversion) has
 * the same ones.
 */
import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";

import {
    createGenosSchema,
    createLegacyMentionSpecs,
    type GenosMentionContext,
} from "../components/editors/genos/genosSchema";
import { GENOS_CHIP_TYPES } from "../components/editors/genos/genosSchemaParts";
import { genosStyleSpecs } from "../components/editors/genosStyleSpecs";
import { createHeadlessNoteSchema } from "../components/editors/headlessNoteSchema";
import { buildCommentSchema } from "../components/editors/sub/CommentEditorWithMentions";
import {
    createMentionGroupSpecV3,
    createMentionSpecV3,
} from "../features/channel/components/MentionV3";

const ctx: GenosMentionContext = {
    teamMemberProfiles: {},
    socket: null,
    myself: {} as never,
    setMyself: () => {},
    useUISM: {} as never,
    useCM: {} as never,
};

/** Every way a surface builds its schema: legacy chips (13 wrappers) and the v3 composer's. */
const SURFACE_SCHEMAS = {
    "legacy mention chips (wrappers)": () => createGenosSchema(createLegacyMentionSpecs(ctx)),
    "v3 mention chips (MessageComposerV3)": () =>
        createGenosSchema({
            mention: createMentionSpecV3("u1"),
            mentionGroup: createMentionGroupSpecV3(),
        }),
};

// What a body round trip depends on: node and mark types, and each node's attributes with
// their defaults. A render function is not part of it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const describePm = (editor: BlockNoteEditor<any, any, any>) => ({
    nodes: Object.fromEntries(
        Object.entries(editor.pmSchema.nodes)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([name, node]) => [
                name,
                {
                    content: node.spec.content ?? null,
                    attrs: Object.fromEntries(
                        Object.entries(node.spec.attrs ?? {}).map(([k, v]) => [
                            k,
                            (v as { default?: unknown }).default ?? null,
                        ])
                    ),
                },
            ])
    ),
    marks: Object.keys(editor.pmSchema.marks).sort(),
});

// Written out on purpose: removing a type from the factory must fail HERE, by name.
const REQUIRED_BLOCKS = [
    "paragraph",
    "heading",
    "quote",
    "bulletListItem",
    "numberedListItem",
    "checkListItem",
    "toggleListItem",
    "codeBlock",
    "table",
    "image",
    "file",
    "divider",
    "alert",
    "mathBlock",
    "diagram",
];
const REQUIRED_INLINE = ["link", "math", ...GENOS_CHIP_TYPES];

describe.each(Object.entries(SURFACE_SCHEMAS))("genos schema: %s", (_name, build) => {
    const schema = build();

    it("has every block type, including the ones only some editors offer a menu for", () => {
        expect(Object.keys(schema.blockSpecs)).toEqual(expect.arrayContaining(REQUIRED_BLOCKS));
    });

    it("has every inline type and the seven chips", () => {
        expect(Object.keys(schema.inlineContentSpecs)).toEqual(
            expect.arrayContaining(REQUIRED_INLINE)
        );
    });

    it("offers no audio or video block", () => {
        expect(Object.keys(schema.blockSpecs)).not.toContain("audio");
        expect(Object.keys(schema.blockSpecs)).not.toContain("video");
    });

    it("uses genosStyleSpecs (inline code combines with other styles, MIP-1009)", () => {
        expect(Object.keys(schema.styleSpecs).sort()).toEqual(Object.keys(genosStyleSpecs).sort());
        // ...and the mark really excludes nothing (BlockNote's own `code` mark excludes all).
        expect(BlockNoteEditor.create({ schema }).pmSchema.marks.code.spec.excludes).toBe("");
    });

    it("is the headless schema's twin: same node types, attribute defaults and marks", () => {
        expect(describePm(BlockNoteEditor.create({ schema }))).toEqual(
            describePm(BlockNoteEditor.create({ schema: createHeadlessNoteSchema() }))
        );
    });
});

describe("genos schema: surfaces agree with each other", () => {
    it("the v3 composer's chips have the same shape as the wrappers' (the API reads both)", () => {
        const [a, b] = Object.values(SURFACE_SCHEMAS).map((build) =>
            describePm(BlockNoteEditor.create({ schema: build() }))
        );
        expect(a).toEqual(b);
    });
});

describe("comment schema (the one paragraph-only exception)", () => {
    const comment = buildCommentSchema({
        teamMemberProfiles: {},
        socket: null,
        myself: {} as never,
        setMyself: () => {},
        useUISM: {} as never,
        useCM: {} as never,
    });

    it("is paragraph-only", () => {
        expect(Object.keys(comment.blockSpecs)).toEqual(["paragraph"]);
    });

    it("still knows every chip, so a comment that carries one is not rejected", () => {
        expect(Object.keys(comment.inlineContentSpecs)).toEqual(
            expect.arrayContaining([...GENOS_CHIP_TYPES])
        );
    });
});
