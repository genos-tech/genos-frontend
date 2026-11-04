import { codeBlockOptions } from "@blocknote/code-block";
import { createExtension } from "@blocknote/core";
import { getDiagramBlockTypeSelectItems } from "@blocknote/diagram-block";
import { getMathBlockTypeSelectItems } from "@blocknote/math-block";
import { blockTypeSelectItems, type BlockTypeSelectItem } from "@blocknote/react";
import { RiCodeBoxLine } from "react-icons/ri";

// Enter handler that converts a paragraph starting with "```" into
// a syntax-highlighted code block.
//
// BlockNote 0.49 ships an input rule of shape `^```<lang>\s$` on
// `codeBlock` (see `@blocknote/core/blocks/Code/block.ts`). That
// rule fires when the user types a literal whitespace character
// after the backticks (i.e. Space), but Enter splits the node
// before any whitespace lands in the document, so the rule never
// matches on Enter. This extension closes that gap so the familiar
// Markdown shortcut ``` + Enter works the same way ``` + Space
// already does. Plain Enter inside any other block is left alone
// (we return `false`), and `Mod-Enter` (chat-send) is a different
// keymap binding so it isn't intercepted here either.
// BlockNote's own `getLanguageId` is no longer exported from the package root
// (0.57 declares it but does not re-export it), so this is its logic: a language
// the user typed after the backticks resolves to its id by id or alias.
const getLanguageId = (
    options: typeof codeBlockOptions,
    languageName: string
): string | undefined =>
    Object.entries(options.supportedLanguages ?? {}).find(
        ([id, { aliases }]) => aliases?.includes(languageName) || id === languageName
    )?.[0];

export const codeBlockEnterShortcut = createExtension({
    key: "code-block-enter-shortcut",
    keyboardShortcuts: {
        Enter: ({ editor }) =>
            editor.transact(() => {
                const { block } = editor.getTextCursorPosition();
                if (block.type !== "paragraph") return false;

                const text = ((block.content as any[]) || [])
                    .map((c: any) => (typeof c.text === "string" ? c.text : ""))
                    .join("");
                const match = /^```(.*)$/.exec(text);
                if (!match) return false;

                const requested = match[1].trim();
                const language = requested
                    ? (getLanguageId(codeBlockOptions, requested) ?? requested)
                    : (codeBlockOptions.defaultLanguage ?? "text");

                editor.updateBlock(block, {
                    type: "codeBlock",
                    props: { language },
                    content: [],
                });
                // After `updateBlock` swaps the paragraph for an empty
                // code block, the selection mapped from "end of the
                // old `` ``` `` text" lands just outside the new code
                // block (typically the following block / boundary), so
                // typing would continue OUTSIDE the new code block.
                // Drop the cursor inside the new block so the user can
                // keep typing in it immediately.
                editor.setTextCursorPosition(block.id, "start");
                return true;
            }),
    },
});

// Default `blockTypeSelectItems` (paragraph / headings / lists /
// quote) plus a "Code Block" entry, so the formatting-toolbar
// dropdown can convert the current block to a code block alongside
// the other block-type conversions. Takes the editor (since 0.56 the
// default items follow the schema); the default list has no code block
// entry, so this one is not a duplicate.
export const getBlockTypeSelectItemsWithCodeBlock = (
    editor: Parameters<typeof blockTypeSelectItems>[0]
): BlockTypeSelectItem[] => [
    ...blockTypeSelectItems(editor),
    {
        name: editor.dictionary.slash_menu.code_block.title,
        type: "codeBlock",
        icon: RiCodeBoxLine,
    },
];

/**
 * The block type list for the editors people write documents in (notes, task
 * bodies): the code-block list plus the math and diagram blocks, when the editor's
 * schema has them (MIP-1019).
 */
export const getBlockTypeSelectItemsForDocuments = (
    editor: Parameters<typeof blockTypeSelectItems>[0]
): BlockTypeSelectItem[] => [
    ...getBlockTypeSelectItemsWithCodeBlock(editor),
    ...("mathBlock" in editor.schema.blockSchema ? getMathBlockTypeSelectItems(editor) : []),
    ...("diagram" in editor.schema.blockSchema ? getDiagramBlockTypeSelectItems(editor) : []),
];
