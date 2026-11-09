import { TagListProps } from "../../../types/tasks";

/**
 * The server's `concatTags` for a task row: "/tag1/tag2/", or null with no tags.
 *
 * The table's tag filter matches `/<name>/` against it, so a row built on the
 * client has to use the same separator or the filter would hide it until the
 * next reload. `tagName` is all that is read.
 */
export const buildConcatTags = (
    tags: ReadonlyArray<Pick<TagListProps, "tagName">>
): string | null =>
    tags.length > 0 ? "/" + tags.map((tag) => tag.tagName).join("/") + "/" : null;
