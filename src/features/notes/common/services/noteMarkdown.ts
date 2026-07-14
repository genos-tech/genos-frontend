// Markdown ⇄ BlockNote conversion for note import/export.
//
// Both directions run through a HEADLESS BlockNoteEditor (never mounted,
// created once, default schema) — the same schema-holder trick as
// `applyNoteBodyToYjs`. BlockNote's own parser/serializer give far better
// fidelity than the hand-rolled `agentQA/markdownToBlocks` (code blocks,
// quotes, tables, nested lists), and the notes surfaces already ship the
// editor runtime, so there's no bundle concern in importing it here.
//
// EXPORT GOTCHA the sanitizer exists for: note bodies can contain custom
// types from the notes schema (inline mention / mentionGroup / hashTask /
// hashNote / hashChat / hashProject, block `alert`) which the DEFAULT
// schema doesn't know — `blocksToMarkdownLossy` THROWS "node type X not
// found in schema" on them (verified against 0.49). So export first
// degrades customs to plain text ("@Alice", "#GEN-42 · Fix login"), which
// is also the right reading of them in a .md file.

import { BlockNoteEditor, type PartialBlock } from "@blocknote/core";

// Headless schema holder, created lazily and reused (editor creation is
// not free — it builds a ProseMirror schema).
let holder: BlockNoteEditor | null = null;
const getHolder = (): BlockNoteEditor => {
    if (!holder) {
        holder = BlockNoteEditor.create({ initialContent: [{ type: "paragraph" }] });
    }
    return holder;
};

/** Parse raw markdown text into BlockNote blocks for a new note body. */
export const markdownToNoteBlocks = async (markdown: string): Promise<PartialBlock[]> => {
    const blocks = await getHolder().tryParseMarkdownToBlocks(markdown);
    // A note body must have at least one block (the ProseMirror doc
    // invariant every editor in this codebase maintains).
    return blocks.length > 0 ? (blocks as PartialBlock[]) : [{ type: "paragraph" }];
};

// ---------------------------------------------------------------------------
// Export-side sanitization
// ---------------------------------------------------------------------------

// Default-schema block types (0.49). Anything else is degraded to a
// paragraph, keeping its (sanitized) inline content and children.
const DEFAULT_BLOCK_TYPES = new Set([
    "paragraph",
    "heading",
    "quote",
    "bulletListItem",
    "numberedListItem",
    "checkListItem",
    "codeBlock",
    "table",
    "file",
    "image",
    "video",
    "audio",
]);

type AnyRecord = Record<string, unknown>;

// Best-effort text for a custom inline node. Prop names match the notes
// schema specs (Mention.tsx / HashMention.tsx).
const customInlineToText = (node: AnyRecord): string => {
    const props = (node.props ?? {}) as AnyRecord;
    switch (node.type) {
        case "mention":
            return `@${props.userName ?? "user"}`;
        case "mentionGroup":
            return `@${props.groupName ?? "group"}`;
        case "hashTask": {
            const id = props.displayId ? `#${props.displayId}` : "#task";
            return props.title ? `${id} · ${props.title}` : id;
        }
        case "hashNote":
            return `#${props.title || "note"}`;
        case "hashChat":
            return `#${props.chatName || "chat"}`;
        case "hashProject":
            return `#${props.projectName || "project"}`;
        default: {
            // Unknown future spec — fall back to any string prop so the
            // reference isn't silently dropped from the export.
            const s = Object.values(props).find((v) => typeof v === "string" && v);
            return typeof s === "string" ? s : "";
        }
    }
};

const sanitizeInline = (content: unknown): unknown => {
    if (!Array.isArray(content)) return content;
    return content.map((node) => {
        if (!node || typeof node !== "object") return node;
        const n = node as AnyRecord;
        if (n.type === "text") return n;
        if (n.type === "link") {
            return { ...n, content: sanitizeInline(n.content) };
        }
        // Custom inline → plain styled-less text run.
        return { type: "text", text: customInlineToText(n), styles: {} };
    });
};

// Table content nests inline content two levels down (rows → cells).
const sanitizeTableContent = (content: AnyRecord): AnyRecord => ({
    ...content,
    rows: Array.isArray(content.rows)
        ? content.rows.map((row) => {
              const r = row as AnyRecord;
              return {
                  ...r,
                  cells: Array.isArray(r.cells)
                      ? r.cells.map((cell) =>
                            // 0.49 cells are either bare inline arrays or
                            // {type:"tableCell", content:[...]} wrappers.
                            Array.isArray(cell)
                                ? sanitizeInline(cell)
                                : {
                                      ...(cell as AnyRecord),
                                      content: sanitizeInline((cell as AnyRecord).content),
                                  }
                        )
                      : r.cells,
              };
          })
        : content.rows,
});

/**
 * Degrade custom block/inline types to default-schema equivalents so the
 * headless (default-schema) serializer can't throw. Exported for tests.
 */
export const sanitizeBlocksForMarkdown = (blocks: unknown[]): PartialBlock[] => {
    if (!Array.isArray(blocks)) return [];
    return blocks.map((block) => {
        const b = (block ?? {}) as AnyRecord;
        const type = typeof b.type === "string" ? b.type : "paragraph";
        const children = Array.isArray(b.children) ? sanitizeBlocksForMarkdown(b.children) : [];
        if (type === "table" && b.content && typeof b.content === "object") {
            return {
                ...b,
                content: sanitizeTableContent(b.content as AnyRecord),
                children,
            } as PartialBlock;
        }
        if (!DEFAULT_BLOCK_TYPES.has(type)) {
            // Custom block (e.g. alert) → paragraph. Content shape is the
            // same inline array, so it carries over after sanitizing. Drop
            // the custom props — paragraph only knows the styling defaults.
            return {
                type: "paragraph",
                content: sanitizeInline(b.content) as PartialBlock["content"],
                children,
            } as PartialBlock;
        }
        return { ...b, content: sanitizeInline(b.content), children } as PartialBlock;
    });
};

/** Serialize a note body to markdown (custom types degraded to text). */
export const noteBlocksToMarkdown = async (blocks: unknown[]): Promise<string> => {
    const safe = sanitizeBlocksForMarkdown(Array.isArray(blocks) ? blocks : []);
    if (safe.length === 0) return "";
    return getHolder().blocksToMarkdownLossy(safe as never);
};

// ---------------------------------------------------------------------------
// File helpers
// ---------------------------------------------------------------------------

/** "My Note: draft/v2" → "My Note draft v2.md" (filesystem-safe). */
export const markdownFilename = (title: string): string => {
    const base = (title || "note")
        .replace(/[\\/:*?"<>|]/g, " ") // characters invalid on Windows/macOS
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, 120);
    return `${base || "note"}.md`;
};

/** Strip the extension off an imported filename for the default title. */
export const titleFromFilename = (filename: string): string => {
    const base = filename.replace(/\.(md|markdown|txt)$/i, "").trim();
    return base || "Imported note";
};

/** Trigger a browser download of `markdown` as `<title>.md`. */
export const downloadMarkdown = (title: string, markdown: string): void => {
    const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = markdownFilename(title);
    document.body.appendChild(a);
    a.click();
    a.remove();
    // Give the click a tick to start the download before revoking.
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};
