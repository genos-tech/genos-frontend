/**
 * "Stick to the newest message" policy for the message / comment lists.
 *
 * Pure on purpose, in the same spirit as `resolveJumpScroll.ts`: the
 * surrounding component owns the Virtuoso handle and the mutable
 * bookkeeping, which can't be exercised without a browser. The two rules
 * that are easy to get wrong live here and are unit-tested.
 *
 * The behaviour these two helpers implement, together with Virtuoso's
 * `followOutput`:
 *
 *   - **I posted → always land at the bottom**, even if I had scrolled
 *     up to re-read something before typing. Sending is an explicit "I'm
 *     done reading history" gesture.
 *   - **Someone else posted → follow only if I'm already at the bottom**
 *     (Virtuoso's own `isAtBottom`, within `atBottomThreshold`). A reader
 *     part-way up the history is never yanked.
 *
 * Why `followOutput` rather than a `scrollToIndex` on send: every bubble
 * body is a read-only BlockNote view that measures TALLER once it mounts
 * (see the notes in `MessageListRenderer`). A one-shot scroll fires
 * against the pre-measurement height and lands short, leaving the message
 * that was just sent clipped at the bottom edge. `followOutput` keeps the
 * scroller pinned across that size change (react-virtuoso re-scrolls on
 * its own `notAtBottomBecause === "SIZE_INCREASED"`), which is exactly
 * the correction a timer can't make.
 */

/** What Virtuoso's `followOutput` callback may return here. `"smooth"` is
 *  deliberately unused — an animated scroll on every arriving message
 *  reads as lag on a long list. */
export type FollowOutputDecision = "auto" | false;

/**
 * Did the newest row just become one *I* appended?
 *
 * Called once per change of the tail row's identity, NOT once per render:
 * the caller keeps the previous count / tail key and only recomputes when
 * the tail key moves. That makes the answer specific to "a new row landed
 * at the end" and immune to the other ways the array churns:
 *
 *   - **Reactions / edits / flag toggles** rebuild the array with the same
 *     tail → not recomputed at all.
 *   - **A wider slice patched in behind the tail** (the pane paints from
 *     the cache, then the background `syncChannel` resolves with more
 *     history) grows the count while the tail stays put → not recomputed,
 *     so it can't be mistaken for a send and yank a reader — or override
 *     an in-flight jump-to-message, which `useScrollManagement` owns.
 *   - **The optimistic echo being swapped for the server row** changes the
 *     tail key without growing the count → `count > prevCount` is false.
 *
 * `prevCount > 0` excludes the first fill (mount, or a cold channel whose
 * sync lands after the skeleton). Landing at the bottom there is already
 * `initialTopMostItemIndex`'s job, and forcing it here would fight a deep
 * link that had already scrolled to its target.
 */
export const resolveOwnAppend = ({
    count,
    isOwnTail,
    prevCount,
}: {
    /** Row count after the update. */
    count: number;
    /** Is the newest row authored by the signed-in user? */
    isOwnTail: boolean;
    /** Row count when the tail last changed identity; `0` before the
     *  first fill. */
    prevCount: number;
}): boolean => prevCount > 0 && count > prevCount && isOwnTail;

/**
 * The `followOutput` answer for one count change.
 *
 * `isOwnAppend` is consumed once per append by the caller, so a later
 * count change that isn't a fresh send of mine falls back to the
 * `isAtBottom` rule.
 */
export const resolveFollowOutput = ({
    isAtBottom,
    isOwnAppend,
}: {
    /** Virtuoso's own read of the scroll position. */
    isAtBottom: boolean;
    /** Result of `resolveOwnAppend` for this update. */
    isOwnAppend: boolean;
}): FollowOutputDecision => (isOwnAppend || isAtBottom ? "auto" : false);
