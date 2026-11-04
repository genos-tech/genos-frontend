import { combineByGroup } from "@blocknote/core";
import { createReactDiagramBlockSpec, getDiagramSlashMenuItems } from "@blocknote/diagram-block";
import {
    createReactInlineMathSpec,
    createReactMathBlockSpec,
    getMathSlashMenuItems,
} from "@blocknote/math-block";
import type { DefaultReactSuggestionItem } from "@blocknote/react";

/**
 * The free math and diagram blocks (MIP-1019), `@blocknote/math-block` and
 * `@blocknote/diagram-block` 0.57.0 (MPL), in every editor schema.
 *
 * Every schema that can open a document gets the three types, not only the editors
 * that offer them in a menu: a document is shared (notes, task bodies, and the
 * markdown an agent writes can land in a comment), and an editor whose schema lacks
 * a type DELETES that block from the shared Yjs document. They must also stay in step
 * with genos-collab's schema copy (`bodyReplace.js`) and the API's markdown readers.
 *
 * No CSS is imported here on purpose: this module is also loaded by the compat
 * tool in plain Node (through `headlessNoteSchema`). The editors import
 * `@blocknote/math-block/style.css` (which pulls in KaTeX's) next to BlockNote's own.
 */

export const genosExtraBlockSpecs = {
    mathBlock: createReactMathBlockSpec(),
    diagram: createReactDiagramBlockSpec(),
};

/**
 * Inline math WITHOUT the package's `$...$` input rule: it converts what was typed
 * between two dollar signs the moment the second one is typed, so "$5 and $" would
 * turn "5 and " into a formula. The slash menu item still inserts inline math, and
 * the `$$ ` rule of the block stays. (The API reads `$x$` with a stricter rule that
 * leaves amounts and shell variables alone.)
 */
export const genosExtraInlineContentSpecs = {
    math: { ...createReactInlineMathSpec(), extensions: [] },
};

/**
 * Table options the editors switch on: cell background and text colours, and the
 * header row / column toggles. NOT `splitCells`, which also unlocks merging cells:
 * a markdown table cannot hold a span, so an agent's edit of a note (it rewrites the
 * body from markdown) would break every merged cell back into separate ones. Colours
 * and a header column are also dropped by such an edit (the text is kept); that is
 * the price of this, noted where the options are consumed.
 */
export const genosTableOptions = {
    headers: true,
    cellBackgroundColor: true,
    cellTextColor: true,
} as const;

/**
 * The slash menu with the math and diagram items added, for the editors people write
 * documents in (notes, task bodies). Only items whose spec is in the editor's
 * schema are added.
 */
export const withGenosBlockSlashItems = (
    editor: Parameters<typeof getMathSlashMenuItems>[0],
    items: DefaultReactSuggestionItem[]
): DefaultReactSuggestionItem[] =>
    combineByGroup(items, [
        ...getMathSlashMenuItems(editor),
        ...getDiagramSlashMenuItems(editor),
    ] as DefaultReactSuggestionItem[]);
