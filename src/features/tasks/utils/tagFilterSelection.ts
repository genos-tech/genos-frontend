import { FilterProps } from "../types/TaskTableTypes";
import { rehydrateFilters } from "./taskFilterStorage";

/**
 * The tag dimension of the filter bar, split out of `TaskFilterMenu` so it can
 * be tested — the menu itself is ~3k lines of JSX with no render test, the same
 * reason `taskFilterStorage` and `savedFilterPayload` were extracted.
 *
 * Tags are the only dimension whose option list is BOTH loaded asynchronously
 * and mutable mid-session: creating, renaming or deleting a tag republishes
 * `currentProject.projectTags` (see `useTaskManagement.tagsRevision`), which
 * rebuilds `predefinedTagsFilters` under a selection the user already made.
 * Everything here exists to survive that rebuild.
 */

/**
 * The "no tag filter" selection: the leading "All" entry when the project HAS
 * tags, and an empty list when it doesn't.
 *
 * Every site that resets the tag dimension has to go through this. Writing
 * `[predefinedTagsFilters[0]]` directly puts `[undefined]` into state in a
 * project with no tags (or before they've loaded) — a corrupt selection that
 * then crashes anything reading `tags[0].label`, which `applyFilters` does.
 * `[]` takes the "no tag filter" path in `applyFilters` and means exactly the
 * same thing.
 */
export const tagSelectionDefault = (tagFilters: FilterProps[]): FilterProps[] =>
    tagFilters.length > 0 ? [tagFilters[0]] : [];

/**
 * Carry a live tag selection across a rebuild of the option list.
 *
 * Matched by label, which is the tag's name and the only stable identity a
 * `FilterProps` has. The result always holds the objects from `available`, never
 * the incoming ones: a recoloured tag has to redraw in its new palette, and its
 * `filterModel` predicate must be the current one.
 *
 * Prune-and-preserve rather than reset, because the alternative silently drops
 * the user's filter every time anyone edits any tag. A renamed or deleted tag
 * falls out (there is nothing left for it to match — tag filtering compares
 * `concatTags` by NAME, so a stale name matches no rows at all), and a selection
 * emptied that way falls back to "All" rather than to "nothing shown".
 */
export const remapTagSelection = (
    current: FilterProps[],
    available: FilterProps[]
): FilterProps[] =>
    rehydrateFilters(
        current.map((f) => f.label),
        available,
        tagSelectionDefault(available)
    );

/**
 * Whether two tag selections mean the same thing — i.e. whether a remap was a
 * pure identity/colour refresh or actually changed what the table should show.
 *
 * `TaskFilterMenu`'s reactive `applyFilters` effect does not watch
 * `selectedTags`, so a remap that pruned something has to re-run the filter
 * pipeline itself; one that didn't must NOT, or every tag edit anywhere would
 * churn the table and rewrite storage.
 */
export const sameTagSelection = (a: FilterProps[], b: FilterProps[]): boolean =>
    a.length === b.length && a.every((f, i) => f.label === b[i].label);
