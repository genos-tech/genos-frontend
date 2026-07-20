import { PreviewMediaKind } from "../../../types/chat";

// `t.chat.sidebar` key per media kind — shared so the chat list and the
// activity feed label a text-less row identically.
export const MEDIA_LABEL_KEYS: Record<
    PreviewMediaKind,
    | "previewGif"
    | "previewImage"
    | "previewVideo"
    | "previewAudio"
    | "previewFile"
    | "previewTable"
> = {
    gif: "previewGif",
    image: "previewImage",
    video: "previewVideo",
    audio: "previewAudio",
    file: "previewFile",
    table: "previewTable",
};

const MEDIA_BLOCK_KINDS: Record<string, PreviewMediaKind> = {
    image: "image",
    video: "video",
    audio: "audio",
    file: "file",
    table: "table",
};

/** A GIPHY insert is a standard `image` block whose url ends in `.gif`
 *  (query string and all — `.../giphy.gif?cid=…&ct=g`). Same test
 *  catches an uploaded .gif file, which is the intent: both animate. */
const isGifUrl = (url: unknown): boolean =>
    typeof url === "string" && url.split("?")[0].toLowerCase().endsWith(".gif");

/**
 * Kind of the first media block in a message body, or `null` if the
 * body has none.
 *
 * The stored `body_text` preview deliberately covers only TEXT (see
 * `deriveBodyText` — attachments were never represented, and baking
 * labels into it would pollute search + push notifications). The send
 * path compounds that: `getFirstLine(content[0])` reads only the FIRST
 * block, and `insertGif` inserts the image AFTER the cursor's empty
 * paragraph — so a GIF-only message stores `body_text = ""` and the
 * sidebar rendered a blank row.
 *
 * Callers use this to label such a row from the body they already
 * have in hand. Render-time, so it covers already-sent messages.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function derivePreviewMediaKind(content: any): PreviewMediaKind | null {
    if (!Array.isArray(content)) return null;
    for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const kind = MEDIA_BLOCK_KINDS[block.type as string];
        if (!kind) continue;
        return kind === "image" && isGifUrl(block.props?.url) ? "gif" : kind;
    }
    return null;
}

export function getFirstLine(first_line: any): string {
    if (!first_line || typeof first_line !== "object") return "";
    const blockType: string | undefined = first_line.type;

    if (blockType === "image") {
        const name = first_line?.props?.name;
        return name ? `Image: ${name}` : "Image";
    }

    if (blockType === "file") {
        const name = first_line?.props?.name;
        return name ? `File: ${name}` : "File";
    }

    if (blockType === "table") {
        return "Table";
    }

    if (blockType === "divider") {
        return "";
    }

    // Content-bearing blocks (paragraph, heading, list items, quote,
    // codeBlock, ...) carry an inline-content array. Unknown block
    // types fall through here too — if they happen to have a content
    // array we still extract something useful; otherwise the loop is
    // a no-op and we return "".
    const parts: string[] = [];
    for (const c of (first_line.content as unknown[]) ?? []) {
        if (!c || typeof c !== "object") continue;
        const inline = c as { type?: string; text?: unknown; props?: any; content?: any };
        if (inline.type === "text") {
            const text = String(inline.text ?? "").trim();
            if (text) parts.push(text);
        } else if (inline.type === "mention") {
            const user = inline.props?.userName;
            if (user) parts.push(`@${user}`);
        } else if (inline.type === "mentionGroup") {
            const group = inline.props?.groupName;
            if (group) parts.push(`@${group}`);
        } else if (inline.type === "customEmoji") {
            const emoji = inline.props?.name;
            if (emoji) parts.push(`:${emoji}:`);
        } else if (inline.type === "link") {
            const inner = (inline.content as { text?: string }[]) ?? [];
            if (inner[0]?.text) parts.push(inner[0].text);
        }
        // Unknown inline types are skipped silently — forward-
        // compatibility, not a bug to warn about.
    }

    const joined = parts.join(" ");
    if (joined) return joined;

    // Last-resort label for content-bearing blocks that turned out to
    // be empty (e.g. an empty code block).
    if (blockType === "codeBlock") return "Code";
    return "";
}
