import { codeBlockOptions } from "@blocknote/code-block";
import {
    createCodeBlockSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
} from "@blocknote/core";

import { genosExtraBlockSpecs, genosExtraInlineContentSpecs } from "../genosBlockSpecs";

/**
 * The part of the Genos editor schema that has no React and no per-surface state: the
 * block types and the inline types that are not chips. `createGenosSchema` (the editors)
 * and `createHeadlessNoteSchema` (markdown / Yjs conversion, plain Node) both start here, so
 * a block type added to this file is in every schema at once.
 *
 * The rule (MIP-1019): an editor whose schema lacks a type DELETES that block from the
 * shared Yjs document it opens, and a body with an unknown type makes BlockNote reject the
 * whole body. So no surface gets a smaller set; surfaces differ in menus and toolbars only.
 * The one deliberate exception is the paragraph-only comment schema
 * (`buildCommentSchema`), whose documents the API never writes anything else into.
 */

/** Block types every schema has, `alert` aside (its spec is React, so each side adds its own). */
export const genosBaseBlockSpecs = () => {
    // The editors offer no audio or video blocks.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { audio, video, ...remaining } = defaultBlockSpecs;
    return {
        ...remaining,
        ...genosExtraBlockSpecs,
        // BlockNote 0.49 moved the code-block options out of `useCreateBlockNote` and into the
        // schema: the syntax-highlighted `codeBlock` replaces the default plain-text one.
        codeBlock: createCodeBlockSpec(codeBlockOptions),
    };
};

/** Inline content every schema has, chips aside. */
export const genosBaseInlineContentSpecs = () => ({
    ...defaultInlineContentSpecs,
    ...genosExtraInlineContentSpecs,
});

/** The chip types every schema registers on top of the base set. */
export const GENOS_CHIP_TYPES = [
    "mention",
    "mentionGroup",
    "customEmoji",
    "hashTask",
    "hashNote",
    "hashChat",
    "hashProject",
] as const;
