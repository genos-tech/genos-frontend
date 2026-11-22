// Google Docs "Download → Markdown" export, made readable by the Markdown
// import. The export is valid Markdown but uses three things BlockNote's
// parser does not resolve: reference-style links/images whose definitions sit
// at the end of the file (every embedded picture is `![][image1]` plus a
// `[image1]: <data:image/png;base64,...>` line), footnotes (`[^1]` and
// `[^1]: text`), and links wrapped in a google.com/url redirect. Applied to
// every imported file: all three are ordinary Markdown, so a file that has
// none of them passes through untouched.

const FENCE = /^\s{0,3}(```|~~~)/;
const FOOTNOTE_DEF = /^\[\^([^\]\s]+)\]:\s?(.*)$/;
const LINK_DEF =
    /^\s{0,3}\[([^\]^][^\]]*)\]:\s*(?:<([^>]*)>|(\S+))(?:\s+(?:"[^"]*"|'[^']*'))?\s*$/;
const REDIRECT = /\]\(<?https?:\/\/(?:www\.)?google\.com\/url\?([^)>\s]*)>?\)/g;

const normLabel = (label: string): string => label.trim().replace(/\s+/g, " ").toLowerCase();

const unwrapRedirects = (line: string): string =>
    line.replace(REDIRECT, (whole, query: string) => {
        const target = new URLSearchParams(query).get("q");
        return target && /^https?:\/\//i.test(target)
            ? `](${encodeURI(decodeURI(target))})`
            : whole;
    });

export const hasGoogleDocsMarkers = (markdown: string): boolean =>
    /\]\[[^\]]*\]|\[\^[^\]\s]+\]|google\.com\/url\?/.test(markdown);

export const normalizeGoogleDocsMarkdown = (markdown: string): string => {
    if (!hasGoogleDocsMarkers(markdown)) return markdown;
    const lines = markdown.replace(/\r\n?/g, "\n").split("\n");

    // Pass 1: definitions, outside code fences.
    const links = new Map<string, string>();
    const notes = new Map<string, string[]>();
    const kept: string[] = [];
    let fence: string | null = null;
    let openNote: string[] | null = null;
    for (const line of lines) {
        const f = FENCE.exec(line);
        if (f && (fence === null || fence === f[1])) fence = fence ? null : f[1];
        if (fence !== null || f) {
            kept.push(line);
            continue;
        }
        const fn = FOOTNOTE_DEF.exec(line);
        if (fn) {
            openNote = [fn[2]];
            notes.set(fn[1], openNote);
            continue;
        }
        // A footnote's continuation: indented lines right after its definition.
        if (openNote && /^( {2,}|\t)\S/.test(line)) {
            openNote.push(line.trim());
            continue;
        }
        openNote = null;
        const def = LINK_DEF.exec(line);
        if (def) {
            links.set(normLabel(def[1]), def[2] ?? def[3]);
            continue;
        }
        kept.push(line);
    }

    // Pass 2: references, outside code fences.
    const order: string[] = [];
    fence = null;
    const body = kept.map((line) => {
        const f = FENCE.exec(line);
        if (f && (fence === null || fence === f[1])) fence = fence ? null : f[1];
        if (fence !== null || f) return line;
        let out = unwrapRedirects(line);
        out = out.replace(/(!?)\[([^\]]*)\]\[([^\]]*)\]/g, (whole, bang, text, ref) => {
            const url = links.get(normLabel(ref || text));
            return url ? `${bang}[${text}](${/\s/.test(url) ? `<${url}>` : url})` : whole;
        });
        out = out.replace(/\[\^([^\]\s]+)\]/g, (whole, id: string) => {
            if (!notes.has(id)) return whole;
            if (!order.includes(id)) order.push(id);
            return `[${order.indexOf(id) + 1}]`;
        });
        return out;
    });

    const footnotes = order.map((id, i) => `[${i + 1}] ${(notes.get(id) ?? []).join(" ").trim()}`);
    const text = body.join("\n").replace(/\s+$/, "");
    return footnotes.length ? `${text}\n\n---\n\n${footnotes.join("\n\n")}\n` : `${text}\n`;
};
