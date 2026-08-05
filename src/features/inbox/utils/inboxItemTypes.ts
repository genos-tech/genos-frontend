/**
 * The inbox's two halves, by `InboxItems.item_type`.
 *
 * ACTIVITIES are things that HAPPENED and need no answer; everything else
 * is a REQUEST somebody is waiting on. The split decides three surfaces at
 * once — which tab an item lands on, whether the card offers approve/reject,
 * and whether it counts toward the Requests badge — so it lives in one
 * place: they drifted apart before, and a digest that could not be
 * approved still made the badge claim there was something to approve.
 *
 * Server-side vocabulary: `origin/models/common/inbox_models.py`.
 */

/** activity notice (0), Genos digest (6), message reminder (9). */
export const ACTIVITY_ITEM_TYPES: ReadonlySet<number> = new Set([0, 6, 9]);

export const isActivityItemType = (itemType: number): boolean => ACTIVITY_ITEM_TYPES.has(itemType);
