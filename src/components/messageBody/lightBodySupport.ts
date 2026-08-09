/**
 * Decides whether a message body can be painted by `LightMessageBody`
 * (plain DOM) or has to fall back to `BnChatPreview` (a full
 * BlockNote/ProseMirror editor instance).
 *
 * Why this exists: displaying a message used to cost one editor per
 * bubble — measured at ~50x the mount cost of a plain node — which is
 * the bulk of the lag when switching chats. The overwhelming majority
 * of real messages are paragraphs of text, so they never needed an
 * editor at all.
 *
 * The gate is deliberately CONSERVATIVE and allow-list based: anything
 * this file doesn't explicitly recognise sends the whole message down
 * the BlockNote path, which is always correct because that's what
 * rendered it before. Adding support for a block/inline/style type
 * means adding it BOTH here and in `LightMessageBody` — if it's listed
 * here but not rendered there, it silently disappears from the message.
 */

/** Block types `LightMessageBody` knows how to paint. */
const SUPPORTED_BLOCK_TYPES = new Set([
    "paragraph",
    "heading",
    "bulletListItem",
    "numberedListItem",
    "checkListItem",
    "quote",
    // Media. `video`/`audio` are stripped from the editor schema, so they
    // never reach a saved message; `codeBlock` (Shiki-highlighted) and
    // `table` deliberately stay OFF this list so they keep routing to the
    // full editor.
    "image",
    "file",
]);

/** Inline content types `LightMessageBody` knows how to paint. */
const SUPPORTED_INLINE_TYPES = new Set([
    "text",
    "link",
    "mention",
    "mentionGroup",
    "customEmoji",
    // `#` entity mentions — rendered as plain styled text (see
    // `LightMessageBody`'s `LightHashChip`).
    "hashTask",
    "hashNote",
    "hashChat",
    "hashProject",
]);

/**
 * Text style keys with a known mapping to markup. A style present but
 * falsy (`{bold: false}`) is fine — it renders as unstyled either way.
 */
const SUPPORTED_STYLE_KEYS = new Set([
    "bold",
    "italic",
    "underline",
    "strike",
    "code",
    "textColor",
    "backgroundColor",
]);

const isPlainObject = (v: unknown): v is Record<string, unknown> =>
    typeof v === "object" && v !== null && !Array.isArray(v);

function inlineIsSupported(item: unknown): boolean {
    // BlockNote allows a bare string as inline content shorthand.
    if (typeof item === "string") return true;
    if (!isPlainObject(item)) return false;

    const type = typeof item.type === "string" ? item.type : "text";
    if (!SUPPORTED_INLINE_TYPES.has(type)) return false;

    if (isPlainObject(item.styles)) {
        for (const [key, value] of Object.entries(item.styles)) {
            // A falsy style is a no-op regardless of whether we know it.
            if (!value) continue;
            if (!SUPPORTED_STYLE_KEYS.has(key)) return false;
        }
    }

    // A link carries its own nested inline content.
    if (type === "link") {
        if (!Array.isArray(item.content)) return false;
        return item.content.every(inlineIsSupported);
    }

    return true;
}

function blockIsSupported(block: unknown): boolean {
    if (!isPlainObject(block)) return false;

    const type = typeof block.type === "string" ? block.type : "";
    if (!SUPPORTED_BLOCK_TYPES.has(type)) return false;

    // Table blocks carry a non-array `content` object; media blocks carry
    // none at all. Both are already excluded by type, but guard anyway so
    // an unexpected shape falls back instead of rendering blank.
    if (block.content !== undefined && !Array.isArray(block.content)) return false;
    if (Array.isArray(block.content) && !block.content.every(inlineIsSupported)) return false;

    if (block.children !== undefined) {
        if (!Array.isArray(block.children)) return false;
        if (!block.children.every(blockIsSupported)) return false;
    }

    return true;
}

/**
 * True when every block in `content` is within the light renderer's
 * vocabulary. An empty/whole-empty body counts as supported — it paints
 * nothing, exactly as the editor did.
 */
export function canRenderLight(content: unknown): boolean {
    if (!Array.isArray(content)) return false;
    return content.every(blockIsSupported);
}
