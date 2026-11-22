import { MoreMenuKind, orderMoreMenuItems } from "../../../../components/ui/moreMenuOrder";

/**
 * Splits a menu's items into the ones the user pinned and the rest. The ids
 * of the items in `all` are what the preference stores; an item the menu does
 * not offer for this message (`visible: false`, e.g. Edit on someone else's)
 * is in neither list.
 */
export const splitPinned = <
    T extends { id: string; kind?: MoreMenuKind; danger?: boolean; visible?: boolean },
>(
    all: T[],
    pinned: readonly string[]
): { pinnedItems: T[]; menuItems: T[] } => {
    // Ordered here as well as in `MoreMenu`: the pinned buttons never reach it,
    // and they must follow the menu's own order.
    const shown = orderMoreMenuItems(all);
    return {
        // Pinned buttons follow the menu's own order, whatever order was stored.
        pinnedItems: shown.filter((item) => pinned.includes(item.id)),
        menuItems: shown.filter((item) => !pinned.includes(item.id)),
    };
};
