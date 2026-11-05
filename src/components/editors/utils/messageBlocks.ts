/**
 * The shape of a stored message / task comment body, and what counts as
 * "something to send".
 *
 * A stored body ends with ONE blank paragraph. Up to BlockNote 0.49 the editor
 * kept a real empty block at the end of every document, every message was saved
 * with it, and the renderers dropped it. 0.57 only DRAWS that line (its
 * `trailingBlock` option no longer inserts a block), so the composers' "at least
 * two blocks" check stopped meaning "you typed something" (Send stayed disabled
 * until Enter), and the renderers' unconditional "drop the last block" started
 * hiding the last real line of every message typed since (MIP-1039).
 *
 * The rules now:
 *   - a composer may send when `hasSendableContent` says so;
 *   - it stores `withTrailingBlank(document)`, the shape the server already
 *     writes (genos-api `blocknote_md`), so older readers keep working;
 *   - a reader shows `withoutTrailingBlank(body)`, which drops the last block
 *     ONLY when it is blank, so bodies with and without it both render whole.
 */

type InlineItem = { type?: string; text?: unknown } & Record<string, unknown>;
type Block = {
    id?: string;
    type?: string;
    props?: Record<string, unknown>;
    content?: unknown;
    children?: unknown;
} & Record<string, unknown>;

const isNonBlankInline = (item: unknown): boolean => {
    if (item == null || typeof item !== "object") return false;
    const it = item as InlineItem;
    // A styled-text run counts only with visible text. Anything else inline
    // (a mention or # reference chip, an emoji node, ...) is content on its own.
    if (it.type === "text" || it.type === undefined) {
        return typeof it.text === "string" && it.text.trim() !== "";
    }
    // A link carries its label as nested text runs.
    if (it.type === "link") {
        return Array.isArray(it.content) && it.content.some(isNonBlankInline);
    }
    return true;
};

const childrenOf = (block: Block): Block[] =>
    Array.isArray(block.children) ? (block.children as Block[]) : [];

/** Does this block, or anything nested in it, hold something worth sending? */
const blockHasContent = (block: unknown): boolean => {
    if (block == null || typeof block !== "object") return false;
    const b = block as Block;
    if (Array.isArray(b.content)) {
        if (b.content.some(isNonBlankInline)) return true;
    } else if (b.content != null) {
        // Table content (`{type: "tableContent", rows}`) or another structured
        // content object: the block itself is the content.
        return true;
    } else if (b.type !== undefined && !TEXT_BLOCK_TYPES.has(b.type)) {
        // No inline content at all: an image, a file, a divider, a math or
        // diagram block... The block is the content.
        return true;
    }
    return childrenOf(b).some(blockHasContent);
};

// Blocks whose content is inline text. Anything else with no `content` key is
// a self-contained block (image, file, ...), which is content by itself.
const TEXT_BLOCK_TYPES = new Set([
    "paragraph",
    "heading",
    "quote",
    "bulletListItem",
    "numberedListItem",
    "checkListItem",
    "toggleListItem",
    "codeBlock",
]);

/** Is there anything to send: visible text, a chip, an image or file, a
 *  table, ...? Spaces and empty lines alone are not (decided with Ken). */
export const hasSendableContent = (blocks: unknown): boolean =>
    Array.isArray(blocks) && blocks.some(blockHasContent);

/** An empty paragraph with nothing nested: what the trailing line is. */
export const isBlankParagraph = (block: unknown): boolean => {
    if (block == null || typeof block !== "object") return false;
    const b = block as Block;
    if (b.type !== "paragraph" || childrenOf(b).length > 0) return false;
    if (b.content == null) return true;
    return Array.isArray(b.content) && b.content.length === 0;
};

const blankParagraph = (): Block => ({
    id: globalThis.crypto?.randomUUID?.() ?? `blank-${Date.now()}-${Math.random()}`,
    type: "paragraph",
    props: { textColor: "default", backgroundColor: "default", textAlignment: "left" },
    content: [],
    children: [],
});

/** The body as it is stored: the document plus one blank paragraph at the end,
 *  always, as 0.49's editor kept one after whatever was typed. A blank line the
 *  user typed at the end therefore survives the reader's `withoutTrailingBlank`. */
export const withTrailingBlank = <T>(blocks: T[]): T[] => [
    ...blocks,
    blankParagraph() as unknown as T,
];

/** The body as it is shown: the last block is dropped only when it is blank.
 *  Never returns an empty list, which BlockNote refuses as initial content. */
export const withoutTrailingBlank = <T>(blocks: T[]): T[] => {
    if (!Array.isArray(blocks) || blocks.length === 0) return [blankParagraph() as unknown as T];
    if (!isBlankParagraph(blocks[blocks.length - 1])) return blocks;
    return blocks.length === 1 ? blocks : blocks.slice(0, -1);
};
