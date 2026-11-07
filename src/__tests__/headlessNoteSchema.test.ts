// The headless note schema (`createHeadlessNoteSchema`) is what
// `applyNoteBodyToYjs` converts bodies with. It has to be the NOTE EDITORS'
// schema, or the converter either throws ("node type X not found in schema")
// or silently drops a prop the editor has (MIP-949). The chips' and the
// alert's shape come from one set of configs the editors share
// (`schemaSpecConfigs.ts`); this test pins the rest: that the headless
// assembly registers the same set, with the same options, as the editors'.

import { BlockNoteEditor } from "@blocknote/core";
import { describe, expect, it } from "vitest";

import {
    createGenosSchema,
    createLegacyMentionSpecs,
} from "../components/editors/genos/genosSchema";
import { createHeadlessNoteSchema } from "../components/editors/headlessNoteSchema";

// The editors' schema, from the factory every editor uses. The mention spec closes over
// runtime state that only its `render` reads, so stubs do here.
const buildEditorsSchema = () =>
    createGenosSchema(
        createLegacyMentionSpecs({
            teamMemberProfiles: {},
            socket: null,
            myself: {} as never,
            setMyself: () => {},
            useUISM: {} as never,
            useCM: {} as never,
        })
    );

// What a body conversion depends on: which node and mark types exist and
// which attributes (with which defaults) each carries. A missing node type
// makes the converter throw; a missing attribute is dropped from the doc.
const describeSchema = (pm: BlockNoteEditor["pmSchema"]) => {
    return {
        nodes: Object.fromEntries(
            Object.entries(pm.nodes)
                .sort(([a], [b]) => a.localeCompare(b))
                .map(([name, node]) => [
                    name,
                    {
                        content: node.spec.content ?? null,
                        group: node.spec.group ?? null,
                        attrs: Object.fromEntries(
                            Object.entries(node.spec.attrs ?? {}).map(([attr, spec]) => [
                                attr,
                                (spec as { default?: unknown }).default ?? null,
                            ])
                        ),
                    },
                ])
        ),
        marks: Object.keys(pm.marks).sort(),
    };
};

describe("createHeadlessNoteSchema", () => {
    it("has the same node types, marks and attribute defaults as the note editors' schema", () => {
        const editors = describeSchema(
            BlockNoteEditor.create({ schema: buildEditorsSchema() }).pmSchema
        );
        // Not vacuous: the editors' schema really carries the custom types.
        expect(Object.keys(editors.nodes)).toEqual(
            expect.arrayContaining([
                "mention",
                "mentionGroup",
                "customEmoji",
                "hashTask",
                "hashNote",
                "hashChat",
                "hashProject",
                "alert",
            ])
        );
        expect(
            describeSchema(BlockNoteEditor.create({ schema: createHeadlessNoteSchema() }).pmSchema)
        ).toEqual(editors);
    });
});
