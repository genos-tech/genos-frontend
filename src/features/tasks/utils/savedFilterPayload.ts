import { SavedFilterPayload } from "../services/projectSavedFilters";
import { FilterProps } from "../types/TaskTableTypes";
import { rehydrateFilters, rehydrateKeys } from "./taskFilterStorage";

/**
 * The two pure halves of a Saved Filter round trip: turning the filter
 * bar's current selection into the stored blob, and turning a stored blob
 * back into a selection.
 *
 * Extracted out of `TaskFilterMenu` (~2.8k lines) because the STATUS rule
 * below is subtle enough to deserve unit tests, and there is no way to
 * reach it through that component.
 *
 * Both directions store/read IDENTITY ONLY — labels and keys, never the
 * `FilterProps` objects. Those carry `filterModel` predicates and palette
 * colors that ship with the app, so persisting one would pin a stale copy
 * of the logic. That already mattered for `taskFilterStorage`; a Saved
 * Filter crosses USERS, so it matters more: the stale copy would be
 * everyone's.
 */

/** Field-for-field mirror of the bar's six dimensions. */
export type SavedFilterSelection = {
    status: FilterProps[];
    tags: FilterProps[];
    priorities: FilterProps[];
    effortLevels: FilterProps[];
    // `MilestoneFilterKey[]` / `MemberFilterKey[]` in TaskFilterMenu. Kept
    // loose here (the sentinels are private to that module) and cast at
    // the call site, exactly as `rehydrateKeys` is already used.
    milestoneKeys: (string | number)[];
    memberKeys: string[];
};

/**
 * Read the current selection into the blob that gets stored.
 *
 * `hideStatusFilter` is the whole reason this isn't a one-line object
 * literal. The sprint board HIDES the status dimension and pins it to
 * "All" — its columns *are* the status view. Recording that pinned "All"
 * would make a board-saved filter silently widen a *table* view to
 * include Closed and Deleted rows, so the key is omitted entirely
 * instead: a board-saved filter asserts nothing about status.
 */
export const buildSavedFilterPayload = (input: {
    hideStatusFilter?: boolean;
    status: FilterProps[];
    tags: FilterProps[];
    priorities: FilterProps[];
    effortLevels: FilterProps[];
    milestoneKeys: (string | number)[];
    memberKeys: string[];
}): SavedFilterPayload => ({
    ...(input.hideStatusFilter ? {} : { status: input.status.map((f) => f.label) }),
    tags: input.tags.map((f) => f.label),
    priorities: input.priorities.map((f) => f.label),
    effortLevels: input.effortLevels.map((f) => f.label),
    milestoneKeys: input.milestoneKeys,
    memberKeys: input.memberKeys,
});

/**
 * Resolve a stored blob back into a selection the bar can apply.
 *
 * The mirror of the rule above, and the direction that bites harder: a
 * filter saved from the TABLE can carry `status: ["Open","WIP"]`, and
 * applying that on the board would impose a status filter the board gives
 * the user no way to see or clear — only Reset would shake it off. So
 * where the dimension is hidden, status is PINNED to "All" regardless of
 * what the filter carries, matching the board's mount initializer and its
 * reset path.
 *
 * Missing dimensions fall back to the same defaults a fresh bar uses, so
 * a blob written by an older client (or one deliberately narrow) can't
 * leave the bar with an empty selection — which the menu treats as
 * invalid and the table renders as an empty list.
 *
 * Labels and ids are NOT validated against the current project here.
 * `rehydrateFilters` already drops labels that no longer exist, and the
 * milestone / member prune effects drop stale ids and fall back to "All"
 * — so a teammate's filter naming a deleted tag or a departed member
 * takes exactly the path a stale localStorage entry already takes.
 */
export const resolveSavedFilter = (
    payload: SavedFilterPayload,
    opts: {
        hideStatusFilter?: boolean;
        predefinedStatusFilters: FilterProps[];
        defaultStatusFilters: FilterProps[];
        predefinedTagsFilters: FilterProps[];
        predefinedPriorityFilters: FilterProps[];
        predefinedEffortLevelFilters: FilterProps[];
    }
): SavedFilterSelection => ({
    status: opts.hideStatusFilter
        ? [opts.predefinedStatusFilters[0]]
        : rehydrateFilters(
              payload.status,
              opts.predefinedStatusFilters,
              opts.defaultStatusFilters
          ),
    tags: rehydrateFilters(
        payload.tags,
        opts.predefinedTagsFilters,
        opts.predefinedTagsFilters.length > 0 ? [opts.predefinedTagsFilters[0]] : []
    ),
    priorities: rehydrateFilters(payload.priorities, opts.predefinedPriorityFilters, [
        opts.predefinedPriorityFilters[0],
    ]),
    effortLevels: rehydrateFilters(payload.effortLevels, opts.predefinedEffortLevelFilters, [
        opts.predefinedEffortLevelFilters[0],
    ]),
    milestoneKeys: rehydrateKeys(payload.milestoneKeys) ?? ["all"],
    memberKeys: (rehydrateKeys(payload.memberKeys) as string[] | null) ?? ["__all__"],
});
