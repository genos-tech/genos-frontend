/**
 * Decides how a chat pane should scroll when the user jumps to a
 * specific message (clicking a sidebar activity, a deep link, or a
 * chat-list item).
 *
 * Pure on purpose: the surrounding effect deals with Virtuoso refs and
 * timers, which can't be exercised without a browser. Every rule that's
 * easy to get wrong lives here instead, and is unit-tested.
 *
 * The rules, and why each exists:
 *
 *   1. **No target → no jump.** Opening a chat without a focus target is
 *      the caller's "scroll to LAST" path, not ours.
 *
 *   2. **Only jump for a target we haven't already handled.** The effect
 *      re-runs on every `indexMap` change, which happens whenever a
 *      message arrives or a background sync patches the slice. Without
 *      this, each of those would yank the view back to a jump the user
 *      already finished — so the key is remembered once the scroll
 *      actually happens.
 *
 *   3. **An unresolved target is NOT handled — keep trying.** Clicking an
 *      activity paints the pane from the cached message slice, and a
 *      recent message is often not in it yet; the id only resolves once
 *      the background `syncChannel` patches the messages in and re-fires
 *      the effect. Returning "none" WITHOUT marking the key handled is
 *      what lets that later attempt land. (Marking it here would make
 *      jumping to a new message silently do nothing — the reported bug.)
 *
 *   4. **Near the end → scroll to LAST, not to the index.** Landing a
 *      variable-height list exactly on an item near the end is unreliable
 *      (Virtuoso estimates offsets before the tall task-card rows are
 *      measured, and there isn't a viewport's worth of content below the
 *      target to scroll into anyway). Going to the bottom puts the target
 *      on screen every time, which is what the user actually wants.
 *
 *   5. **Otherwise scroll to the index, centred**, so the message the user
 *      asked for is in the middle of the pane rather than glued to the
 *      top edge.
 *
 * Deliberately NOT a rule: "skip if the target is already visible". The
 * caller can only see a stale visible range (it isn't an effect dep, and
 * on a chat switch it still describes the PREVIOUS chat), so for targets
 * near the bottom — where the range usually sits — it wrongly concluded
 * "already visible" and skipped the scroll entirely. Rule 2 covers the
 * only case that guard was really protecting: not re-scrolling on
 * unrelated `indexMap` churn.
 */

export type JumpScrollAction =
    | { kind: "none" }
    | { kind: "last" }
    | { kind: "index"; index: number; align: "center" };

/**
 * How close to the end counts as "near the latest" (rule 4). Mirrors the
 * `maxIndex - 3` slack the auto-follow path in `useScrollToBottomOnChatChange`
 * already uses, rounded up a little: a target within the last few messages
 * is one the bottom of the list shows anyway.
 */
export const NEAR_LAST_SLACK = 5;

export const resolveJumpScroll = ({
    targetKey,
    resolvedIndex,
    lastIndex,
    lastHandledKey,
}: {
    /** Stable identity of this jump: chat + the message id to focus.
     *  `null` when the pane was opened without a focus target. */
    targetKey: string | null;
    /** Where that message sits in the current list, or `null` when the
     *  id isn't in the loaded slice yet. */
    resolvedIndex: number | null | undefined;
    /** Index of the newest message (`count - 1`); `-1` for an empty list. */
    lastIndex: number;
    /** The last `targetKey` that produced an actual scroll. */
    lastHandledKey: string | null;
}): JumpScrollAction => {
    if (!targetKey) return { kind: "none" };
    if (targetKey === lastHandledKey) return { kind: "none" };
    // `!= null` rather than a truthy test: index 0 (the oldest loaded
    // message) is a perfectly good target and must not read as "missing".
    if (resolvedIndex == null || !Number.isFinite(resolvedIndex) || resolvedIndex < 0) {
        return { kind: "none" };
    }
    if (lastIndex >= 0 && resolvedIndex >= lastIndex - NEAR_LAST_SLACK) {
        return { kind: "last" };
    }
    return { align: "center", index: resolvedIndex, kind: "index" };
};
