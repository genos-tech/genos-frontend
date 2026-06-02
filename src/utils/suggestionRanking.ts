// Filtering + relevance ranking for BlockNote suggestion menus (`@` and
// `#` mentions).
//
// Two jobs:
//   1. STRICT filtering — keep only items whose title/alias contains the
//      typed query as a substring ("part of word"); drop everything else.
//   2. RANKING — float the closest match to the top: exact match first,
//      then prefix, then substring. Sort is stable (ES2019+), so items
//      sharing a tier keep their incoming order.
//
// We do the filtering ourselves (rather than BlockNote's
// `filterSuggestionItems`) so the behavior is fully under our control and
// can't drift with the library.

import { DefaultReactSuggestionItem } from "@blocknote/react";

// Lower = closer. q is assumed already lower-cased / trimmed.
const matchRank = (item: DefaultReactSuggestionItem, q: string): number => {
    const candidates = [item.title, ...(item.aliases ?? [])].map((s) => (s || "").toLowerCase());
    if (candidates.some((c) => c === q)) return 0;
    if (candidates.some((c) => c.startsWith(q))) return 1;
    return 2;
};

const matchesQuery = (item: DefaultReactSuggestionItem, q: string): boolean =>
    [item.title, ...(item.aliases ?? [])].some((s) => (s || "").toLowerCase().includes(q));

// Filter to substring matches, then rank exact → prefix → substring. An
// empty query is a no-op (preserves the caller's default ordering, e.g.
// self-first for users).
export const filterAndRankSuggestionItems = (
    items: DefaultReactSuggestionItem[],
    query: string
): DefaultReactSuggestionItem[] => {
    const q = (query || "").trim().toLowerCase();
    if (!q) return items;
    return items
        .filter((it) => matchesQuery(it, q))
        .sort((a, b) => matchRank(a, q) - matchRank(b, q));
};
