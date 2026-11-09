import { TaskTableProps } from "../../../types/tasks";

/**
 * Fold a fresh read of a project's rows into the rows already on screen.
 *
 * - Nothing added, nothing removed and every row's `updatedAt` as before:
 *   hand back `prev` itself, so the array identity (and everything memoized on
 *   it: the filter pipeline, the table's tree indexes, the board's columns)
 *   stays put. The order of the read does not matter: a row that moved to
 *   another status group has a new `updatedAt`, so it is a change anyway.
 * - Otherwise a new array in the READ's order, where every row whose id and
 *   `updatedAt` match a row already shown is that very object. A memoized row
 *   component then skips its render, and only the rows that really changed
 *   (or are new) render again. A row that is gone from the read is gone from
 *   the result.
 *
 * Rows match on `id` + `updatedAt` + `lastProgressAt`: the first two are the
 * rule the old all-or-nothing check already used (a field the server changes
 * without stamping `updatedAt` is not seen, and a row patched locally keeps its
 * patch until the server's `updatedAt` for it moves). `lastProgressAt` is the
 * exception that matters (MIP-1351): a parent or milestone whose CHILD changed
 * has a new `lastProgressAt` and the same `updatedAt`, and without it here the
 * old row would be kept and the new value never drawn.
 */
export const mergeProjectRows = (
    prev: TaskTableProps[],
    next: TaskTableProps[]
): TaskTableProps[] => {
    const prevById = new Map<string, TaskTableProps>();
    for (const row of prev) {
        if (row.id != null) prevById.set(String(row.id), row);
    }
    const matched = new Set<string>();
    const merged = next.map((row) => {
        if (row.id == null) return row;
        const key = String(row.id);
        const old = prevById.get(key);
        if (
            old !== undefined &&
            old.updatedAt === row.updatedAt &&
            (old.lastProgressAt ?? null) === (row.lastProgressAt ?? null)
        ) {
            matched.add(key);
            return old;
        }
        return row;
    });
    // Same count, and every row shown was matched by exactly one row of the
    // read (`matched` counts distinct ids, so a duplicate in the read cannot
    // stand in for a row it does not contain): the two are the same set.
    if (merged.length === prev.length && matched.size === prev.length) return prev;
    return merged;
};
