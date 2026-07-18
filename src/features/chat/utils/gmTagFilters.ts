/**
 * Pure filtering/selection helpers for the GM personal-tag feature.
 *
 * Mirrors `activityChipFilters.ts`: the sidebar keeps its selection
 * state in `ChatSidebar`, threads it down, and every consumer derives
 * through these pure functions so the logic is unit-testable without
 * rendering.
 *
 * Semantics: selected tag chips OR-compose (a GM passes when it carries
 * ANY selected tag). The Activity filter AND-composes because its chips
 * are orthogonal facets; personal tags are all one facet and a GM
 * typically carries 1-2 of them, so AND would near-always produce an
 * empty list. An empty selection passes everything — same short-circuit
 * convention as `makeChipFilter`.
 */

import { AllChatProps } from "../../../types/chat";
import { PersonalTag } from "../../../types/personalTags";

/** Stable frozen empty set — pass this (never a fresh `new Set()`) as
 *  the "no tag filter" value so memoized consumers keep identity. */
export const EMPTY_TAG_ID_SET: ReadonlySet<number> = new Set<number>();

/** How many chips the filter row shows before overflow (the Custom
 *  menu always reaches the full tag list). Matches the server's
 *  recency cap so the two paths agree. */
export const VISIBLE_CHIP_CAP = 6;

/**
 * Build the chat-list predicate for the current selection. Unknown tag
 * ids (e.g. a tag deleted in another tab) simply never match — worst
 * case is an empty list, never a crash.
 */
export const makeTagFilter = (
    selected: ReadonlySet<number>,
    assignmentsByChannelId: Record<string, readonly number[]>
): ((chat: AllChatProps) => boolean) => {
    if (selected.size === 0) return () => true;
    return (chat: AllChatProps): boolean => {
        const ids = assignmentsByChannelId[chat.chatId];
        if (!ids) return false;
        return ids.some((id) => selected.has(id));
    };
};

const byPinOrder = (a: PersonalTag, b: PersonalTag): number =>
    a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);

/**
 * The chips rendered in the filter row.
 *
 * - Pinned tags (local `isDefaultVisible`, live — a pin toggle updates
 *   the row instantly without waiting for a server round-trip) win when
 *   any exist; otherwise the server's recency-derived
 *   `defaultVisibleTagIds` (filtered to tags that still exist), capped.
 * - Currently-SELECTED tags always union into the row (appended in tag
 *   order) so an active filter is always removable in place, even when
 *   it isn't part of the default set.
 */
export const selectVisibleTagChips = (
    tags: readonly PersonalTag[],
    defaultVisibleTagIds: readonly number[],
    selected: ReadonlySet<number>
): PersonalTag[] => {
    const byId = new Map(tags.map((t) => [t.tagId, t]));

    const pinned = tags.filter((t) => t.isDefaultVisible).sort(byPinOrder);
    let visible: PersonalTag[];
    if (pinned.length > 0) {
        visible = pinned;
    } else {
        visible = defaultVisibleTagIds
            .map((id) => byId.get(id))
            .filter((t): t is PersonalTag => t !== undefined)
            .slice(0, VISIBLE_CHIP_CAP);
    }

    const shown = new Set(visible.map((t) => t.tagId));
    for (const tag of tags) {
        if (selected.has(tag.tagId) && !shown.has(tag.tagId)) {
            shown.add(tag.tagId);
            visible = [...visible, tag];
        }
    }
    return visible;
};

/**
 * Drop selected ids whose tag no longer exists (deleted here or in
 * another tab). Returns the SAME set instance when nothing changed so
 * effects keyed on identity don't loop.
 */
export const pruneSelection = (
    selected: ReadonlySet<number>,
    tags: readonly PersonalTag[]
): ReadonlySet<number> => {
    if (selected.size === 0) return selected;
    const live = new Set(tags.map((t) => t.tagId));
    let changed = false;
    const next = new Set<number>();
    for (const id of selected) {
        if (live.has(id)) {
            next.add(id);
        } else {
            changed = true;
        }
    }
    return changed ? next : selected;
};
