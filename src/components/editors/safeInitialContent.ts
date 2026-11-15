// `initialContent` an editor can always take (MIP-1604).
//
// BlockNote converts `initialContent` while the editor is being constructed, and one block it
// cannot build makes `BlockNoteEditor.create` throw ("Error creating document from blocks
// passed as `initialContent`"). From inside a component that is a crash of the whole subtree:
// a chat message, a to-do's notes, a template or a note opened without a collab server. The
// body comes from outside the editor (the REST api, an agent, an import), so it is checked
// here, before the editor is made, with the same degrade-don't-reject rule as the seed and the
// restore path (`sanitizeBlocksForEditor`).
//
// The check runs against the headless note schema, not the editor being built: that is the
// schema every Genos surface has to share (`GenosSchema.test.ts`), and an editor cannot be
// asked for its ProseMirror schema before it exists. It is built lazily, once, the first time a
// body is checked.
import type { PartialBlock } from "@blocknote/core";

import { createHeadlessNoteEditor, type HeadlessNoteEditor } from "./headlessNoteSchema";
import { logSanitizeReport, sanitizeBlocksForEditor, type SanitizeReport } from "./safeBlocks";

let holder: HeadlessNoteEditor | null = null;
const getHolder = (): HeadlessNoteEditor => (holder ??= createHeadlessNoteEditor());

/**
 * `content` ready for `initialContent`: a block the schema cannot build degrades to plain text
 * (or is dropped when it has none), a code block's language resolves to one the editor has.
 * Returns the same array when nothing changed. `undefined` when there is nothing to open with
 * (BlockNote refuses an empty array, and falls back to one empty paragraph without the option).
 * Never throws.
 */
export const safeInitialContent = <T extends PartialBlock[] | unknown[]>(
    content: T | undefined,
    where = "opening the body"
): T | undefined => {
    if (!Array.isArray(content) || content.length === 0) return undefined;
    const report: SanitizeReport = { degraded: 0, skipped: 0 };
    try {
        const safe = sanitizeBlocksForEditor(content, getHolder(), report) as unknown as T;
        logSanitizeReport(where, report);
        return safe.length > 0 ? safe : undefined;
    } catch (error) {
        // The checker itself failed (not a bad block): hand the body over as it came.
        console.error("[editor] could not check the body before opening it:", error);
        return content;
    }
};
