// Convert the LLM's markdown output into BlockNote `PartialBlock[]`
// so the saved note renders headings, lists, bold, italic and citation
// links natively in the editor — instead of leaking raw markdown
// control characters like `### Summary` or `**Participants**`.
//
// Scope: deliberately small. The LLM's prompt instructs it to produce
// a constrained markdown vocabulary (headings 1–3, paragraphs, bullets,
// bold, italic). This parser handles those cases plus citation tokens
// (`[chat:dm:5:thread:4]`) which become inline link blocks. Anything
// the parser doesn't recognise degrades to a plain paragraph rather
// than being lost.
//
// Why not BlockNote's built-in `markdownToBlocks`? It exists at
// `@blocknote/core/api/parsers/markdown/parseMarkdown` but requires
// a Prosemirror Schema (which means instantiating an editor) and has
// no hook for citation rewriting. Hand-rolling here gives us the
// citation pass for free and keeps the dependency surface small.

// Type-only on purpose: a value import of @blocknote/core would pull
// the whole editor runtime into every consumer of the agentQA barrel
// (SpotlightOverlay is in the initial entry chunk).
import type { PartialBlock } from "@blocknote/core";

import { SpotlightResult } from "../spotlight/types";
import { CITATION_LINK_PATTERN, CITATION_PATTERN, sourceToUrl } from "./citationUtils";

const HEADING_PROPS = {
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

const PARA_PROPS = {
    textColor: "default",
    textAlignment: "left",
    backgroundColor: "default",
} as const;

type InlineStyle = { bold?: true; italic?: true };

interface TextRun {
    text: string;
    styles: InlineStyle;
}

interface LinkRun {
    kind: "link";
    text: string;
    href: string;
}

type InlineNode = ({ kind: "text" } & TextRun) | LinkRun;

// Convert one inline string (no block markers) into a list of inline
// nodes. Recognises:
//   - `**bold**`  /  `__bold__`
//   - `*italic*`  /  `_italic_`
//   - `[prose](type:id)` natural-prose citation links (§4.6) → link whose
//     text is the model's prose, href resolved via `sourceToUrl`
//   - bare `[type:id]` citation tokens (fallback) → link whose text is the
//     source title
const tokenizeInline = (text: string, sourcesById: Map<string, SpotlightResult>): InlineNode[] => {
    if (!text) return [];

    // Pass 1: extract citation tokens, replacing them with link nodes.
    // Pass 2 (recursive) handles bold/italic inside non-citation text.
    // Matches BOTH citation forms in one sweep. Link form groups:
    // 1=prose, 2=token; bare form group: 3=token.
    const out: InlineNode[] = [];
    let cursor = 0;
    const re = new RegExp(`${CITATION_LINK_PATTERN.source}|${CITATION_PATTERN.source}`, "g");
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > cursor) {
            out.push(...tokenizeFormatting(text.slice(cursor, m.index)));
        }
        const isLinkForm = m[2] !== undefined;
        const entityId = isLinkForm ? m[2] : m[3];
        const source = sourcesById.get(entityId);
        if (isLinkForm) {
            // Natural-prose link: the visible text is the model's grammatical
            // prose (m[1]). Resolve to a real deep-link; if unresolved, keep
            // the prose as plain text (no dead link) — matches the render-side
            // resolve-guard in `rewriteCitations`.
            if (source) {
                out.push({
                    kind: "link",
                    text: m[1],
                    href: sourceToUrl(source) || `#${entityId}`,
                });
            } else {
                out.push(...tokenizeFormatting(m[1]));
            }
        } else if (source) {
            const label = (source.title || "").trim() || entityId;
            out.push({ kind: "link", text: label, href: sourceToUrl(source) || `#${entityId}` });
        } else {
            // Unresolved bare token — keep the raw token as plain text so
            // the user sees what the model intended.
            out.push(...tokenizeFormatting(m[0]));
        }
        cursor = m.index + m[0].length;
    }
    if (cursor < text.length) {
        out.push(...tokenizeFormatting(text.slice(cursor)));
    }
    return out;
};

// Tokenise a citation-free run for bold/italic. Bold is matched first
// (greedy `**...**`) since the italic regex would otherwise eat the
// first `*` of `**`. Nested formatting (e.g. bold+italic) is NOT
// supported — the LLM doesn't reliably emit it.
const tokenizeFormatting = (text: string): InlineNode[] => {
    if (!text) return [];
    const out: InlineNode[] = [];
    // Combined alternation: **bold**, __bold__, *italic*, _italic_.
    // Lookbehind/lookahead avoid matching mid-word underscores
    // ("snake_case_name") as italics.
    const re =
        /\*\*(.+?)\*\*|__(.+?)__|(?<![A-Za-z0-9])\*([^*\s][^*]*?)\*(?![A-Za-z0-9])|(?<![A-Za-z0-9])_([^_\s][^_]*?)_(?![A-Za-z0-9])/g;
    let cursor = 0;
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
        if (m.index > cursor) {
            out.push({ kind: "text", text: text.slice(cursor, m.index), styles: {} });
        }
        if (m[1] !== undefined || m[2] !== undefined) {
            out.push({ kind: "text", text: m[1] ?? m[2] ?? "", styles: { bold: true } });
        } else if (m[3] !== undefined || m[4] !== undefined) {
            out.push({ kind: "text", text: m[3] ?? m[4] ?? "", styles: { italic: true } });
        }
        cursor = m.index + m[0].length;
    }
    if (cursor < text.length) {
        out.push({ kind: "text", text: text.slice(cursor), styles: {} });
    }
    return out;
};

// Convert inline nodes to BlockNote inline content shape.
//
// Return type is intentionally untyped (`any[]`): the `@blocknote/core`
// package bundles its `.d.ts` files in two locations (`dist/` and
// `types/`) which TypeScript treats as distinct nominal types — even
// though they're structurally identical — and rejects the cross-path
// assignment. The runtime shape is correct; the editor + server both
// consume this JSON without trouble.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const inlineNodesToContent = (nodes: InlineNode[]): any[] => {
    return nodes.map((n) => {
        if (n.kind === "link") {
            return {
                type: "link",
                href: n.href,
                content: [{ type: "text", text: n.text, styles: {} }],
            };
        }
        return { type: "text", text: n.text, styles: n.styles };
    });
};

// One block (or zero, if the text was empty).
const makeParagraph = (text: string, sourcesById: Map<string, SpotlightResult>): PartialBlock => ({
    type: "paragraph",
    props: PARA_PROPS,
    content: inlineNodesToContent(tokenizeInline(text, sourcesById)),
    children: [],
});

const makeHeading = (
    text: string,
    level: 1 | 2 | 3,
    sourcesById: Map<string, SpotlightResult>
): PartialBlock => ({
    type: "heading",
    props: { ...HEADING_PROPS, level },
    content: inlineNodesToContent(tokenizeInline(text, sourcesById)),
    children: [],
});

const makeBullet = (text: string, sourcesById: Map<string, SpotlightResult>): PartialBlock => ({
    type: "bulletListItem",
    props: PARA_PROPS,
    content: inlineNodesToContent(tokenizeInline(text, sourcesById)),
    children: [],
});

const makeNumbered = (text: string, sourcesById: Map<string, SpotlightResult>): PartialBlock => ({
    type: "numberedListItem",
    props: PARA_PROPS,
    content: inlineNodesToContent(tokenizeInline(text, sourcesById)),
    children: [],
});

// Main entry: parse the LLM's markdown into PartialBlock[]. Always
// returns at least one block (an empty paragraph for empty input) so
// the caller can append to the result without checking emptiness.
export const markdownToBlocks = (
    markdown: string,
    sourcesById: Map<string, SpotlightResult> = new Map()
): PartialBlock[] => {
    const text = (markdown || "").trim();
    if (!text) {
        return [
            {
                type: "paragraph",
                props: PARA_PROPS,
                content: [],
                children: [],
            },
        ];
    }

    const blocks: PartialBlock[] = [];
    const lines = text.split(/\r?\n/);
    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // Blank line — block boundary; skip.
        if (!trimmed) {
            i++;
            continue;
        }

        // Headings: # / ## / ### (level 1-3 only; deeper levels render
        // as level-3 since BlockNote's default theme caps there).
        const headingMatch = /^(#{1,3})\s+(.+)$/.exec(trimmed);
        if (headingMatch) {
            const level = Math.min(headingMatch[1].length, 3) as 1 | 2 | 3;
            blocks.push(makeHeading(headingMatch[2], level, sourcesById));
            i++;
            continue;
        }

        // Bullet list: collect consecutive `- `, `* `, `• ` lines.
        if (/^[-*•]\s+/.test(trimmed)) {
            while (i < lines.length) {
                const l = lines[i].trim();
                const mm = /^[-*•]\s+(.*)$/.exec(l);
                if (!mm) break;
                blocks.push(makeBullet(mm[1], sourcesById));
                i++;
            }
            continue;
        }

        // Numbered list: `1. `, `2. ` ...
        if (/^\d+\.\s+/.test(trimmed)) {
            while (i < lines.length) {
                const l = lines[i].trim();
                const mm = /^\d+\.\s+(.*)$/.exec(l);
                if (!mm) break;
                blocks.push(makeNumbered(mm[1], sourcesById));
                i++;
            }
            continue;
        }

        // Paragraph: collect until blank line or block-starting line.
        const buf: string[] = [trimmed];
        i++;
        while (i < lines.length) {
            const next = lines[i];
            const nextTrim = next.trim();
            if (!nextTrim) break;
            if (
                /^(#{1,3})\s+/.test(nextTrim) ||
                /^[-*•]\s+/.test(nextTrim) ||
                /^\d+\.\s+/.test(nextTrim)
            ) {
                break;
            }
            // Markdown line-continuation backslash at end ("foo\") just
            // adds a soft break — collapse to a space since BlockNote
            // paragraphs don't natively render hard line breaks here.
            buf.push(nextTrim.replace(/\\$/, ""));
            i++;
        }
        // Join with spaces; the LLM tends to wrap mid-thought.
        blocks.push(makeParagraph(buf.join(" "), sourcesById));
    }

    if (blocks.length === 0) {
        return [makeParagraph(text, sourcesById)];
    }
    return blocks;
};
