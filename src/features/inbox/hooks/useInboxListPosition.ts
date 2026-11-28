import { useCallback, useEffect, useRef, useState } from "react";
import type { VirtuosoHandle } from "react-virtuoso";

import type { InboxItemProps } from "../../../types/common";

// Room for items to be prepended: Virtuoso counts `firstItemIndex` down from here.
const START_INDEX = 1_000_000;

// How many items of `next` arrived above everything that was already listed. A read flip, an
// answered request or a removal changes the array but adds nothing at the top, so it counts 0.
export const countNewAtTop = (prev: InboxItemProps[], next: InboxItemProps[]): number => {
    const known = new Set(prev.map((item) => item.itemId));
    const firstKnown = next.findIndex((item) => known.has(item.itemId));
    return firstKnown > 0 ? firstKnown : 0;
};

/**
 * Keeps an inbox list where the person left it when its items change (MIP-2543).
 *
 * The only change that may move the list is a NEW item at the top: shown at once when the person
 * is at (or near) the top, and otherwise slid in above them by lowering `firstItemIndex`, which
 * keeps the rows they are reading where they are.
 */
export const useInboxListPosition = (items: InboxItemProps[]) => {
    const virtuosoRef = useRef<VirtuosoHandle | null>(null);
    const atTopRef = useRef(true);
    const atTopStateChange = useCallback((atTop: boolean) => {
        atTopRef.current = atTop;
    }, []);

    // Adjusted during render: `firstItemIndex` has to change in the same commit as the items.
    const [position, setPosition] = useState({ items, firstItemIndex: START_INDEX, reveals: 0 });
    if (position.items !== items) {
        const added = countNewAtTop(position.items, items);
        const atTop = atTopRef.current;
        setPosition({
            items,
            firstItemIndex: position.firstItemIndex - (atTop ? 0 : added),
            reveals: position.reveals + (atTop && added > 0 ? 1 : 0),
        });
    }

    useEffect(() => {
        if (position.reveals === 0) return;
        virtuosoRef.current?.scrollToIndex({ index: 0, behavior: "auto" });
    }, [position.reveals]);

    return { virtuosoRef, atTopStateChange, firstItemIndex: position.firstItemIndex };
};
