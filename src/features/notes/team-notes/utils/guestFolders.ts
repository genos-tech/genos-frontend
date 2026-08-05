/**
 * Telling our team's folders apart from the ones another team lent us.
 *
 * A shared folder is a team folder in every mechanical sense — same rows,
 * same roles, same storage, same note bucket — so the only thing that marks
 * it is `isExternal`, set by the server on the folder that was actually
 * shared. Which side of that line a folder is on decides where it hangs in
 * the sidebar: ours under Team Notes, theirs under Shared Notes, where
 * everything else somebody shared with us already goes.
 */

type Ownable = { isExternal?: boolean };

type Linked = Ownable & {
    folderId: number;
    parentFolderId: number | null;
};

/** `[ours, theirs]`, in that order. */
export const splitFoldersByOwnership = <T extends Ownable>(folders: T[]): [T[], T[]] => [
    folders.filter((f) => f.isExternal !== true),
    folders.filter((f) => f.isExternal === true),
];

/**
 * Is this folder one another team shared with us, or inside one?
 *
 * Walks up the chain rather than reading the flag off the folder, because
 * only the folder that was lent carries it — a subfolder created inside it
 * is just as much theirs, and treating it as ours is how someone offers to
 * delete work they don't own.
 */
export const isInGuestFolder = (
    folders: Linked[],
    folderId: number | null | undefined
): boolean => {
    let cursor = folderId ?? null;
    const seen = new Set<number>();
    while (cursor != null && !seen.has(cursor)) {
        seen.add(cursor);
        const folder = folders.find((f) => f.folderId === cursor);
        if (!folder) return false;
        if (folder.isExternal === true) return true;
        cursor = folder.parentFolderId;
    }
    return false;
};
