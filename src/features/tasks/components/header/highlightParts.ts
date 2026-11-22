export type HighlightPart = { text: string; match: boolean };

/**
 * `text` cut into runs, with every case-insensitive occurrence of `query` marked.
 * A blank query, or none found, gives the whole text as one unmarked run.
 */
export const highlightParts = (text: string, query: string): HighlightPart[] => {
    const q = query.trim().replace(/^#/, "").toLowerCase();
    if (!q) return [{ text, match: false }];
    const lower = text.toLowerCase();
    // Lower-casing can change a string's length (e.g. "İ"); then positions don't line up.
    if (lower.length !== text.length) return [{ text, match: false }];
    const parts: HighlightPart[] = [];
    let from = 0;
    for (let at = lower.indexOf(q); at !== -1; at = lower.indexOf(q, from)) {
        if (at > from) parts.push({ text: text.slice(from, at), match: false });
        parts.push({ text: text.slice(at, at + q.length), match: true });
        from = at + q.length;
    }
    if (from < text.length) parts.push({ text: text.slice(from), match: false });
    return parts.length ? parts : [{ text, match: false }];
};
