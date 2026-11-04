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
type ParsedBlocks = Awaited<ReturnType<BlockNoteEditor["tryParseMarkdownToBlocks"]>>;
let holder: BlockNoteEditor | null = null;
const getHolder = (): BlockNoteEditor => {
    if (!holder) {
        holder = BlockNoteEditor.create({ initialContent: [{ type: "paragraph" }] });
    }
    return holder;
};

// BlockNote's markdown parser (replaced in 0.51) leaves the backslash escapes
// of a link destination in the href: `[t](https://x/Foo_\(bar\))` reads as
// `https://x/Foo_\(bar\)`, a broken address, and the serializer escapes
// parentheses and backslashes exactly that way, so an exported note came back
// with its links changed. CommonMark processes those escapes (any ASCII
// punctuation) when it reads a destination; do it here.
const ESCAPED_PUNCTUATION = /\\([!-/:-@[-`{-~])/g;

type AnyRecord = Record<string, unknown>;

const unescapeLinkHrefs = <T>(node: T): T => {
    if (Array.isArray(node)) return node.map(unescapeLinkHrefs) as T;
    if (!node || typeof node !== "object") return node;
    const source = node as AnyRecord;
    const out: AnyRecord = {};
    for (const [key, value] of Object.entries(source)) out[key] = unescapeLinkHrefs(value);
    if (source.type === "link" && typeof source.href === "string") {
        out.href = source.href.replace(ESCAPED_PUNCTUATION, "$1");
    }
    return out as T;
};

// Math and diagram blocks (MIP-1019). The holder has the default schema, so the
// parser knows neither: a fence tagged `math` or `mermaid` arrives as a code block,
// `$$ x $$` as a paragraph and `$x$` as text. The editors' schemas have the types, so
// the result is read back the way the API's `markdown_to_blocks` reads it (the same
// rule, kept in step with `blocknote_md.py`, `_INLINE_MATH_RE`).
const FENCED_BLOCK_TYPES: Record<string, string> = { math: "mathBlock", mermaid: "diagram" };
const BLOCK_FENCES: Record<string, string> = { mathBlock: "math", diagram: "mermaid" };
const DISPLAY_MATH = /^\$\$\s*([\s\S]*?\S)\s*\$\$$/;

const isAsciiAlnum = (ch: string | undefined): boolean => !!ch && /[A-Za-z0-9]/.test(ch);
const isSpace = (ch: string | undefined): boolean => !ch || /\s/.test(ch);

/**
 * Inline math in a run of text: `$` + a non-space, no `$` or newline inside (a
 * backslash escapes), a non-space + `$`, and neither dollar touching an ASCII letter
 * or digit on its outer side, so "$5 and $10" and `$HOME/$USER` stay text. Written
 * by hand: a regex lookbehind stops older iOS Safari from even parsing this chunk.
 */
export const findInlineMath = (text: string): { start: number; end: number; source: string }[] => {
    const found: { start: number; end: number; source: string }[] = [];
    let i = 0;
    while (i < text.length) {
        if (text[i] !== "$") {
            i++;
            continue;
        }
        const before = text[i - 1];
        const next = text[i + 1];
        if (
            isAsciiAlnum(before) ||
            before === "\\" ||
            before === "$" ||
            isSpace(next) ||
            next === "$"
        ) {
            i++;
            continue;
        }
        let j = i + 1;
        let close = -1;
        while (j < text.length) {
            const ch = text[j];
            if (ch === "\n") break;
            if (ch === "\\") {
                j += 2;
                continue;
            }
            if (ch === "$") {
                const last = text[j - 1];
                if (
                    !isSpace(last) &&
                    last !== "\\" &&
                    !isAsciiAlnum(text[j + 1]) &&
                    text[j + 1] !== "$"
                ) {
                    close = j;
                }
                break;
            }
            j++;
        }
        if (close < 0) {
            i++;
            continue;
        }
        found.push({ start: i, end: close + 1, source: text.slice(i + 1, close) });
        i = close + 1;
    }
    return found;
};

const splitInlineMath = (items: unknown[]): unknown[] =>
    items.flatMap((item) => {
        const node = item as AnyRecord;
        const styles = (node?.styles ?? {}) as AnyRecord;
        if (node?.type !== "text" || typeof node.text !== "string" || styles.code) return [item];
        const matches = findInlineMath(node.text);
        if (matches.length === 0) return [item];
        const out: unknown[] = [];
        let cursor = 0;
        for (const m of matches) {
            if (m.start > cursor) out.push({ ...node, text: node.text.slice(cursor, m.start) });
            out.push({ type: "math", props: {}, content: m.source });
            cursor = m.end;
        }
        if (cursor < node.text.length) out.push({ ...node, text: node.text.slice(cursor) });
        return out;
    });

const restoreMathInContent = (content: unknown): unknown => {
    if (Array.isArray(content)) return splitInlineMath(content);
    const table = content as AnyRecord | null;
    if (table && typeof table === "object" && Array.isArray(table.rows)) {
        return {
            ...table,
            rows: (table.rows as AnyRecord[]).map((row) => ({
                ...row,
                cells: ((row.cells as unknown[]) ?? []).map((cell) =>
                    Array.isArray(cell)
                        ? splitInlineMath(cell)
                        : {
                              ...(cell as AnyRecord),
                              content: splitInlineMath(
                                  ((cell as AnyRecord).content as unknown[]) ?? []
                              ),
                          }
                ),
            })),
        };
    }
    return content;
};

const restoreMathBlocks = (blocks: unknown[]): unknown[] =>
    blocks.map((raw) => {
        const block = raw as AnyRecord;
        const children = Array.isArray(block.children)
            ? restoreMathBlocks(block.children)
            : block.children;
        const props = (block.props ?? {}) as AnyRecord;
        if (block.type === "codeBlock") {
            const target =
                FENCED_BLOCK_TYPES[
                    String(props.language ?? "")
                        .trim()
                        .toLowerCase()
                ];
            if (target) return { ...block, type: target, props: {}, children };
        }
        if (block.type === "paragraph" && Array.isArray(block.content)) {
            const items = block.content as AnyRecord[];
            if (
                items.length > 0 &&
                items.every(
                    (i) => i.type === "text" && !Object.keys((i.styles ?? {}) as AnyRecord).length
                )
            ) {
                const display = DISPLAY_MATH.exec(items.map((i) => String(i.text ?? "")).join(""));
                if (display) {
                    return {
                        type: "mathBlock",
                        props: {},
                        content: [{ type: "text", text: display[1], styles: {} }],
                        children,
                    };
                }
            }
        }
        return { ...block, content: restoreMathInContent(block.content), children };
    });

/** Parse raw markdown text into BlockNote blocks for a new note body. */
export const markdownToNoteBlocks = async (markdown: string): Promise<PartialBlock[]> => {
    const blocks = restoreMathBlocks(
        unescapeLinkHrefs(await getHolder().tryParseMarkdownToBlocks(markdown))
    ) as ParsedBlocks;
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
        case "customEmoji":
            // Shortcode, not the URL the default branch would pick up.
            return props.name ? `:${props.name}:` : "";
        default: {
            // Unknown future spec — fall back to any string prop so the
            // reference isn't silently dropped from the export.
            const s = Object.values(props).find((v) => typeof v === "string" && v);
            return typeof s === "string" ? s : "";
        }
    }
};

// Inline math as `$source$`, what `markdownToNoteBlocks` and the API's reader read back. A
// source with a bare `$` (LaTeX writes a dollar sign as `\\$`) cannot sit between dollars:
// it becomes a code span instead of being dropped.
const mathInlineToText = (content: unknown): AnyRecord => {
    const source = String(content ?? "")
        .split(/\s+/)
        .filter(Boolean)
        .join(" ");
    if (!source) return { type: "text", text: "", styles: {} };
    const bareDollar = source.split("").some((ch, i) => ch === "$" && source[i - 1] !== "\\");
    return bareDollar
        ? { type: "text", text: source, styles: { code: true } }
        : { type: "text", text: `$${source}$`, styles: {} };
};

const sanitizeInline = (content: unknown): unknown => {
    if (!Array.isArray(content)) return content;
    return content.map((node) => {
        if (!node || typeof node !== "object") return node;
        const n = node as AnyRecord;
        if (n.type === "text") return n;
        if (n.type === "math") return mathInlineToText(n.content);
        if (n.type === "link") {
            // A raw space ends a markdown link destination, so the address
            // would be cut at it on import (0.49 wrote it as %20).
            const href =
                typeof n.href === "string" ? n.href.replace(/\s/g, encodeURIComponent) : n.href;
            return { ...n, href, content: sanitizeInline(n.content) };
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
        if (type in BLOCK_FENCES) {
            // Math and diagram blocks hold their source as one plain text run: a code
            // block fenced `math` / `mermaid`, which the API and the import read back.
            const source = Array.isArray(b.content)
                ? (b.content as AnyRecord[]).map((i) => String(i.text ?? "")).join("")
                : "";
            return {
                type: "codeBlock",
                props: { language: BLOCK_FENCES[type] },
                content: source ? [{ type: "text", text: source, styles: {} }] : [],
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
