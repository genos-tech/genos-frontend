import { codeBlockOptions } from "@blocknote/code-block";
import { createExtension, type Dictionary, getLanguageId } from "@blocknote/core";
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
// the other block-type conversions.
export const getBlockTypeSelectItemsWithCodeBlock = (
    dict: Dictionary & Record<string, any>
): BlockTypeSelectItem[] => [
    ...blockTypeSelectItems(dict),
    {
        name: dict.slash_menu.code_block.title,
        type: "codeBlock",
        icon: RiCodeBoxLine,
    },
];
