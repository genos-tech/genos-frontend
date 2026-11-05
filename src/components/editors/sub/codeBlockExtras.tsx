import { codeBlockOptions } from "@blocknote/code-block";
import { createExtension } from "@blocknote/core";
import { blockTypeSelectItems, type BlockTypeSelectItem } from "@blocknote/react";
import { RiCodeBoxLine } from "react-icons/ri";

import { getDiagramBlockTypeSelectItems } from "../blocks/diagramBlock";
import { getMathBlockTypeSelectItems } from "../blocks/mathBlocks";

// A ``` fence typed at the start of a paragraph (then Space or Enter) becomes a code block.
// BlockNote 0.51+ does this itself, on both keys, with ONE input rule; the Enter-key handler
// this file used to carry was redundant on 0.57 (MIP-1011) and is gone. What stays is a copy
// of that rule with one change, below: the language it puts in the block.
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

/**
 * The language of a code block made by typing ``` and a name. BlockNote's own rule (0.57) puts
 * the TYPED text in the block when it is not a language it has, and the block's language
 * dropdown then throws while rendering: the editor stays wedged (every later edit throws)
 * until the page is reloaded. So an unknown name, such as ```math or ```nope, gives plain text.
 * `codeFence.test.ts` pins this for both the Enter and the Space path.
 */
const codeLanguageFor = (requested: string): string =>
    requested
        ? (getLanguageId(codeBlockOptions, requested) ?? "text")
        : (codeBlockOptions.defaultLanguage ?? "text");

export const codeFenceInputRule = createExtension({
    key: "code-fence-input-rule",
    // BlockNote's own rule is `^```(.*?)\s$`, run for Space and for Enter alike.
    inputRules: [
        {
            find: /^```(.*?)\s$/,
            replace: ({ match }) => ({
                type: "codeBlock",
                props: { language: codeLanguageFor(match[1].trim()) },
                content: [],
            }),
        },
    ],
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
