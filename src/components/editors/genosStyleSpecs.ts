import { defaultStyleSpecs } from "@blocknote/core";

/**
 * BlockNote's text styles, with one change: inline code may be combined with
 * the other styles (MIP-1009).
 *
 * BlockNote's own `code` style excludes every other style: ProseMirror will not
 * hold a text node that is both bold and code. 0.49 never checked that when it
 * was handed block JSON, so 310 stored messages, comments and task bodies that
 * carry `bold` + `code` (the usual shape of `**\`name\`**` written by an agent or
 * pasted from markdown) loaded without complaint. 0.57 does check: it throws
 * "Invalid collection of marks for node text: bold,code" from `initialContent`,
 * `replaceBlocks` and `insertBlocks`, so each of those documents would fail to
 * open, and the next agent-written one would too.
 *
 * This keeps the code style as BlockNote defines it (its input rule and its
 * rendering) and drops only the exclusion, so those documents read, and look,
 * exactly as they did on 0.49: checked on all 311 affected documents, whose
 * blocks come out identical to what 0.49 produced. The one difference in the
 * editor: switching `code` on over bold text keeps the bold instead of removing
 * it.
 *
 * Every `BlockNoteSchema.create` passes this as `styleSpecs` (a source-scan test
 * fails the build when one does not). A schema without it rejects such a body.
 */
const code = defaultStyleSpecs.code;

export const genosStyleSpecs: typeof defaultStyleSpecs = {
    ...defaultStyleSpecs,
    code: {
        ...code,
        implementation: {
            ...code.implementation,
            mark: code.implementation.mark.extend({ excludes: "" }),
        },
    },
};
