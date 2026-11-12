import {
    PINNABLE_BUBBLE_ACTIONS,
    PinnableBubbleAction,
} from "../../../../hooks/common/useBubbleActionsPreference";
import type { PinnedBubbleAction } from "./BubblePinnedActions";

/** The toolbar's "Mark done" on a flagged message (MIP-1423). Never pinnable: it is
 *  shown because of the message's state, not because of a setting. */
export const MARK_DONE_ACTION = "markDone" as const;

/**
 * What a message's toolbar treats as pinned. While the message is flagged, the flag
 * itself is not: its toolbar slot goes to Mark done (`withMarkDone`), and the flag item
 * ("Remove flag") stays in the "…" menu, so it is never on the toolbar twice and never
 * missing from the menu (MIP-1423).
 */
export const pinnedForFlagState = (
    pinned: readonly PinnableBubbleAction[],
    isFlagged: boolean
): readonly PinnableBubbleAction[] => (isFlagged ? pinned.filter((id) => id !== "flag") : pinned);

const toolbarRank = (id: PinnedBubbleAction["id"]): number =>
    PINNABLE_BUBBLE_ACTIONS.indexOf(id === MARK_DONE_ACTION ? "flag" : id);

/**
 * The toolbar's buttons with Mark done in the flag's place, in the menu's order
 * (MIP-1423). `markDone` is null when the message is not flagged. It is shown whatever
 * the user pinned: the person who flagged a message needs one click to finish it.
 */
export const withMarkDone = (
    actions: PinnedBubbleAction[],
    markDone: PinnedBubbleAction | null
): PinnedBubbleAction[] => {
    if (!markDone) return actions;
    const rank = toolbarRank(MARK_DONE_ACTION);
    const at = actions.findIndex((action) => toolbarRank(action.id) > rank);
    return at === -1
        ? [...actions, markDone]
        : [...actions.slice(0, at), markDone, ...actions.slice(at)];
};
