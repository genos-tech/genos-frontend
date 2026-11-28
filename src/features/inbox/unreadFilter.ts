// The Inbox's "Unread" filter (MIP-2597): off until the member turns it on.
//
// The choice is kept for the tab's session (sessionStorage), as the chat list's filter is not
// remembered either. Storage can be blocked or absent (private windows, tests): then it just
// starts off.

import { useCallback, useMemo, useState } from "react";

import type { InboxItemProps } from "../../types/common";

const STORAGE_KEY = "genos:inbox:unread-only";

const load = (): boolean => {
    try {
        return window.sessionStorage.getItem(STORAGE_KEY) === "1";
    } catch {
        return false;
    }
};

export const useUnreadOnly = () => {
    const [unreadOnly, setUnreadOnly] = useState(load);
    const toggle = useCallback(() => {
        setUnreadOnly((on) => {
            try {
                window.sessionStorage.setItem(STORAGE_KEY, on ? "0" : "1");
            } catch {
                /* the choice still holds until the Inbox is left */
            }
            return !on;
        });
    }, []);
    return [unreadOnly, toggle] as const;
};

/**
 * What the list shows with the filter on: the unread items, by the badge's own rule
 * (`isRead === false`, so a waiting request counts), PLUS every item that was unread at any
 * point since this list was opened. A card read under the reader's eyes therefore stays where it
 * is, and goes only when the list is opened again (leaving, switching tab, the filter off and on,
 * a reload). The card the route points at shows too, or a link to a read card would open nothing.
 */
export const useUnreadItems = (
    items: InboxItemProps[],
    unreadOnly: boolean,
    selectedItemId?: number
): InboxItemProps[] => {
    const [kept, setKept] = useState<ReadonlySet<number>>(new Set());
    // Adjusted during render, so a card is held from the first frame that shows it.
    const arrived = unreadOnly ? items.filter((i) => !i.isRead && !kept.has(i.itemId)) : [];
    if (arrived.length > 0) setKept(new Set([...kept, ...arrived.map((i) => i.itemId)]));

    // Memoised: the list's scroll position is worked out from a change of this array.
    return useMemo(
        () =>
            unreadOnly
                ? items.filter(
                      (i) => !i.isRead || kept.has(i.itemId) || i.itemId === selectedItemId
                  )
                : items,
        [items, unreadOnly, kept, selectedItemId]
    );
};
