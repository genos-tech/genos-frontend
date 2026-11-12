/**
 * "Which notes match what I typed?" for the notes sidebar's filter field (MIP-1431).
 *
 * Titles only, over the lists the sidebar already holds: no request, no wait. Spotlight
 * (which reads note text) stays the way to find a note by what is in it.
 *
 * A note matches when EVERY word of the query is somewhere in its title, in any order, with
 * case, width (Ａ/A) and accents of the compatibility kind folded (NFKC + lower case). A
 * title that starts with the query comes first, then one that has a word starting with it,
 * then the rest; the most recently updated first inside each.
 */

type TitledNote = { noteId: number; title?: string | null; tsUpdated?: string | null };

export type NoteFilterHit<N extends TitledNote> = { noteType: number; note: N };

const fold = (text: string): string => text.normalize("NFKC").toLowerCase();

/** The words of a query, folded. Empty for a query of nothing but whitespace. */
export const queryWords = (query: string): string[] =>
    fold(query)
        .split(/\s+/)
        .filter((word) => word.length > 0);

const WORD_START = /[\s\-_/.,:;()[\]{}'"‘’“”「」『』・]/;

/** 0 starts the title, 1 starts a word in it, 2 is somewhere inside. */
const rank = (title: string, words: readonly string[]): number => {
    const first = words[0];
    if (title.startsWith(first)) return 0;
    const at = title.indexOf(first);
    return at > 0 && WORD_START.test(title[at - 1]) ? 1 : 2;
};

export const filterNotesByTitle = <N extends TitledNote>(
    query: string,
    groups: readonly { noteType: number; notes: readonly N[] }[],
    limit = 50
): { hits: NoteFilterHit<N>[]; total: number } => {
    const words = queryWords(query);
    if (words.length === 0) return { hits: [], total: 0 };

    const seen = new Set<string>();
    const scored: { hit: NoteFilterHit<N>; rank: number; title: string }[] = [];
    for (const { noteType, notes } of groups) {
        for (const note of notes) {
            const key = `${noteType}:${note.noteId}`;
            if (seen.has(key)) continue;
            const title = fold(note.title ?? "");
            if (!words.every((word) => title.includes(word))) continue;
            seen.add(key);
            scored.push({ hit: { noteType, note }, rank: rank(title, words), title });
        }
    }
    scored.sort(
        (a, b) =>
            a.rank - b.rank ||
            (b.hit.note.tsUpdated ?? "").localeCompare(a.hit.note.tsUpdated ?? "") ||
            a.title.localeCompare(b.title)
    );
    return { hits: scored.slice(0, limit).map((s) => s.hit), total: scored.length };
};
