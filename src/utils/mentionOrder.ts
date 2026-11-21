// Order for `@` pickers that mix people and groups (MIP-1701).
//
// Rank, lowest first:
//   0  a group whose name is exactly the query
//   1  a person whose name is exactly the query
//   2  a group (prefix or substring match)
//   3  a person (prefix or substring match)
//
// Groups sit above people because a department group is what the person
// usually wants when a shared word matches both; the exact-name rule keeps
// a person named exactly like the query first. Matching itself is done by
// the caller; this only orders what it kept.
//
// The sort is stable, so items sharing a rank keep their incoming order.

export const groupsBeforePeopleRank = (label: string, isGroup: boolean, query: string): number => {
    const q = query.trim().toLowerCase();
    const exact = label.trim().toLowerCase() === q;
    return (exact ? 0 : 2) + (isGroup ? 0 : 1);
};

// Stable-sorts `items` by `groupsBeforePeopleRank`. An empty query is a no-op.
export const orderGroupsFirst = <T>(
    items: readonly T[],
    query: string,
    view: (item: T) => { label: string; isGroup: boolean }
): T[] => {
    if (!query.trim()) return [...items];
    return items
        .map((item, index) => {
            const { label, isGroup } = view(item);
            return { item, index, rank: groupsBeforePeopleRank(label, isGroup, query) };
        })
        .sort((a, b) => a.rank - b.rank || a.index - b.index)
        .map(({ item }) => item);
};
