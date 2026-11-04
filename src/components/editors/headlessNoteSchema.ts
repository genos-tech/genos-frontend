import { codeBlockOptions } from "@blocknote/code-block";
import {
    BlockNoteEditor,
    BlockNoteSchema,
    createBlockSpec,
    createCodeBlockSpec,
    createInlineContentSpec,
    defaultBlockSpecs,
    defaultInlineContentSpecs,
} from "@blocknote/core";

import { getMessages } from "../../i18n";
import { genosStyleSpecs } from "./genosStyleSpecs";
import {
    ALERT_SPEC_CONFIG,
    CUSTOM_EMOJI_SPEC_CONFIG,
    HASH_CHAT_SPEC_CONFIG,
    HASH_NOTE_SPEC_CONFIG,
    HASH_PROJECT_SPEC_CONFIG,
    HASH_TASK_SPEC_CONFIG,
    MENTION_SPEC_CONFIG,
    mentionGroupSpecConfig,
} from "./schemaSpecConfigs";

// The note editors' schema without the editors: blocks, inline chips and
// styles, built from the same configs the editors register
// (`schemaSpecConfigs.ts`), with a stub `render` that nothing ever calls.
//
// For service code that has to convert BlockNote blocks to or from a
// ProseMirror / Yjs document without mounting an editor
// (`applyNoteBodyToYjs`). It exists because the DEFAULT schema throws on
// any block or inline type it doesn't know ("node type mention not found in
// schema"), and a note body can carry all of them: `@` mentions and `#`
// references an agent writes (MIP-708), the alert callout, team emoji.
//
// What it mirrors (`bnMyNoteEditor` / `bnTaskNoteEditor` /
// `bnChatNoteEditor`, which are identical here): the default blocks minus
// audio and video, the highlighted `codeBlock` (same options, so the
// `language` prop default is the editors'), the `alert` block, the default
// inline content plus the seven chips, and the default styles. Nothing is
// imported from React, Mantine or MUI, so loading this pulls in no editor UI.

const inlineStub = () => ({ dom: document.createElement("span") });
const blockStub = () => ({
    dom: document.createElement("div"),
    contentDOM: document.createElement("div"),
});

export const createHeadlessNoteSchema = () => {
    // Same removal the editors make: the note editors don't offer these.
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { audio, video, ...remainingBlockSpecs } = defaultBlockSpecs;
    return BlockNoteSchema.create({
        styleSpecs: genosStyleSpecs,
        inlineContentSpecs: {
            ...defaultInlineContentSpecs,
            mention: createInlineContentSpec(MENTION_SPEC_CONFIG, { render: inlineStub }),
            mentionGroup: createInlineContentSpec(
                mentionGroupSpecConfig(getMessages().common.editor.mentionGroupFallback),
                { render: inlineStub }
            ),
            customEmoji: createInlineContentSpec(CUSTOM_EMOJI_SPEC_CONFIG, {
                render: inlineStub,
            }),
            hashTask: createInlineContentSpec(HASH_TASK_SPEC_CONFIG, { render: inlineStub }),
            hashNote: createInlineContentSpec(HASH_NOTE_SPEC_CONFIG, { render: inlineStub }),
            hashChat: createInlineContentSpec(HASH_CHAT_SPEC_CONFIG, { render: inlineStub }),
            hashProject: createInlineContentSpec(HASH_PROJECT_SPEC_CONFIG, {
                render: inlineStub,
            }),
        },
        blockSpecs: {
            ...remainingBlockSpecs,
            codeBlock: createCodeBlockSpec(codeBlockOptions),
            alert: createBlockSpec(ALERT_SPEC_CONFIG, { render: blockStub })(),
        },
    });
};

/** A never-mounted editor over {@link createHeadlessNoteSchema}, used only
 * as a schema holder (`editor.pmSchema` exists from construction). Build it
 * once and reuse it: creating one assembles a ProseMirror schema. */
export const createHeadlessNoteEditor = () =>
    BlockNoteEditor.create({
        schema: createHeadlessNoteSchema(),
        initialContent: [{ type: "paragraph" }],
    });

export type HeadlessNoteEditor = ReturnType<typeof createHeadlessNoteEditor>;
