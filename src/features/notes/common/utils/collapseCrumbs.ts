/**
 * Collapsing a breadcrumb trail down to its useful ends.
 *
 * A note nested a few folders deep produced a trail long enough to
 * overflow the header and turn into a horizontal scrollbar — so the two
 * crumbs that actually matter (where am I, and what's directly above
 * me) were the ones pushed off-screen.
 *
 * The kept crumbs are the LAST ones, not the first: the root badge is
 * always rendered separately, and the tail is what tells the user their
 * position. Everything between collapses behind a show-more control that
 * sits right after the root, so the trail still reads left-to-right in
 * document order once expanded.
 */

/** Crumbs kept visible when collapsed: the parent and the current item.
 *  With the always-present root badge that's three things on screen. */
export const DEFAULT_VISIBLE_TAIL = 2;

export interface CollapsedTrail<T> {
    /** Crumbs folded behind the show-more control, in original order.
     *  Empty when the trail is already short enough. */
    hidden: T[];
    /** Crumbs rendered after the control. */
    visible: T[];
}

/**
 * Split a trail into hidden and visible parts.
 *
 * `visibleTail` is a maximum, not a target — a trail shorter than it is
 * returned whole with nothing hidden, so short trails don't sprout a
 * show-more control that would reveal nothing.
 */
export const collapseCrumbs = <T>(
    trail: T[],
    visibleTail: number = DEFAULT_VISIBLE_TAIL
): CollapsedTrail<T> => {
    // A non-positive budget would otherwise hide the current item too,
    // leaving the user with no idea where they are.
    const keep = Math.max(1, visibleTail);
    if (trail.length <= keep) return { hidden: [], visible: trail };
    return {
        hidden: trail.slice(0, trail.length - keep),
        visible: trail.slice(trail.length - keep),
    };
};
