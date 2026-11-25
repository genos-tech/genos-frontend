/**
 * `allNoteIdChains` after recording the ancestor chain of one note (MIP-1678).
 *
 * Returns `prev` ITSELF when the entry already holds the same ids. The chain effects run on every
 * tab switch and on every tree refresh; a new object each time made `useNoteManagement` commit,
 * and so re-render the whole Notes page, for a state that had not changed.
 */
export const mergeNoteIdChain = (
    prev: Record<string, number[]>,
    key: string,
    ids: number[]
): Record<string, number[]> => {
    const old = prev[key];
    if (old && old.length === ids.length && old.every((id, i) => id === ids[i])) {
        return prev;
    }
    return { ...prev, [key]: ids };
};
