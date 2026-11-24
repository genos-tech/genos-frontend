/**
 * The small Markdown subset the manual source is written in (see `src/manual/manualSource.ts`):
 * `##` headings, paragraphs, `- ` bullets, `1. ` lists, pipe tables, and inline **bold**, *italic*,
 * `code` and [label](target) links. Pure functions with no React, shared by the page renderer and
 * the search index so both read the text the same way.
 */

export type Block =
    | { type: "heading"; level: 2 | 3; text: string; id: string }
    | { type: "paragraph"; text: string }
    | { type: "ul"; items: string[] }
    | { type: "ol"; items: string[] }
    | { type: "table"; head: string[]; rows: string[][] };

/** A heading's anchor: lower-case words joined with "-", keeping letters of any script. */
export const slugify = (text: string): string => {
    const slug = text
        .normalize("NFKC")
        .toLowerCase()
        .replace(/[`*]/g, "")
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "");
    return slug === "" ? "section" : slug;
};

const splitRow = (line: string): string[] =>
    line
        .trim()
        .replace(/^\||\|$/g, "")
        .split("|")
        .map((cell) => cell.trim());

const isDivider = (line: string): boolean =>
    /^\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(line);

/** Parse a topic's Markdown into blocks. Heading ids are unique within the topic. */
export const parseBlocks = (markdown: string): Block[] => {
    const lines = markdown.replace(/\r\n/g, "\n").split("\n");
    const blocks: Block[] = [];
    const used = new Map<string, number>();
    const idFor = (text: string): string => {
        const base = slugify(text);
        const n = used.get(base) ?? 0;
        used.set(base, n + 1);
        return n === 0 ? base : `${base}-${n + 1}`;
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        if (line.trim() === "") {
            i += 1;
            continue;
        }
        const heading = /^(#{2,3})\s+(.+?)\s*#*\s*$/.exec(line);
        if (heading) {
            const text = heading[2];
            blocks.push({
                type: "heading",
                level: heading[1].length === 2 ? 2 : 3,
                text,
                id: idFor(text),
            });
            i += 1;
            continue;
        }
        if (line.trimStart().startsWith("|") && i + 1 < lines.length && isDivider(lines[i + 1])) {
            const head = splitRow(line);
            const rows: string[][] = [];
            i += 2;
            while (i < lines.length && lines[i].trimStart().startsWith("|")) {
                rows.push(splitRow(lines[i]));
                i += 1;
            }
            blocks.push({ type: "table", head, rows });
            continue;
        }
        if (/^\s*[-*]\s+/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\s*[-*]\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*[-*]\s+/, ""));
                i += 1;
                // A wrapped line belongs to the item above it.
                while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
                    items[items.length - 1] += ` ${lines[i].trim()}`;
                    i += 1;
                }
            }
            blocks.push({ type: "ul", items });
            continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
                items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
                i += 1;
                while (i < lines.length && /^\s{2,}\S/.test(lines[i])) {
                    items[items.length - 1] += ` ${lines[i].trim()}`;
                    i += 1;
                }
            }
            blocks.push({ type: "ol", items });
            continue;
        }
        const paragraph: string[] = [];
        while (
            i < lines.length &&
            lines[i].trim() !== "" &&
            !/^#{2,3}\s/.test(lines[i]) &&
            !/^\s*[-*]\s+/.test(lines[i]) &&
            !/^\s*\d+\.\s+/.test(lines[i]) &&
            !lines[i].trimStart().startsWith("|")
        ) {
            paragraph.push(lines[i].trim());
            i += 1;
        }
        // Guard against a line the rules above cannot place, so the loop always advances.
        if (paragraph.length === 0) {
            paragraph.push(line.trim());
            i += 1;
        }
        blocks.push({ type: "paragraph", text: paragraph.join(" ") });
    }
    return blocks;
};

export type InlinePart =
    | { type: "text"; text: string }
    | { type: "bold"; text: string }
    | { type: "italic"; text: string }
    | { type: "code"; text: string }
    | { type: "link"; text: string; href: string };

const INLINE = /(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\([^)]+\)|\*[^*\s][^*]*\*)/;

/** Split one line of text into inline parts. */
export const parseInline = (text: string): InlinePart[] =>
    text
        .split(INLINE)
        .filter((part) => part !== "")
        .map((part): InlinePart => {
            if (part.startsWith("**") && part.endsWith("**") && part.length > 4) {
                return { type: "bold", text: part.slice(2, -2) };
            }
            if (part.startsWith("`") && part.endsWith("`") && part.length > 2) {
                return { type: "code", text: part.slice(1, -1) };
            }
            const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
            if (link) return { type: "link", text: link[1], href: link[2] };
            if (part.startsWith("*") && part.endsWith("*") && part.length > 2) {
                return { type: "italic", text: part.slice(1, -1) };
            }
            return { type: "text", text: part };
        });

/** The text of a line with its inline marks removed, for search and snippets. */
export const plainText = (text: string): string =>
    parseInline(text)
        .map((part) => part.text)
        .join("");
