// A folder and its ancestors, innermost first — what has to be unfolded
// for the folder's row to show. The seen set guards a corrupt parent loop.
export const folderChain = (
    folderId: number,
    folders: readonly { folderId: number; parentFolderId: number | null }[]
): number[] => {
    const parentOf = new Map(folders.map((f) => [f.folderId, f.parentFolderId]));
    const chain: number[] = [];
    const seen = new Set<number>();
    for (let id: number | null | undefined = folderId; id != null && !seen.has(id); ) {
        seen.add(id);
        chain.push(id);
        id = parentOf.get(id);
    }
    return chain;
};
