import { useEffect, useState } from "react";

import { popInboxItems } from "../../features/inbox/services/popInboxItems";
import { isActivityItemType } from "../../features/inbox/utils/inboxItemTypes";
import { InboxItemProps } from "../../types/common";

export interface InboxManagementState {
    inboxItems: InboxItemProps[];
    setInboxItems: (items: InboxItemProps[]) => void;
    /** Every unread item, requests and activities: what the sidebar, the bottom bar and the app
     *  icon show (MIP-1627; they used to count requests only). */
    unReadInboxItemCount: number;
    setUnReadInboxItemCount: (count: number) => void;
    /** Unread requests: the Requests tab's count. */
    unReadRequestCount: number;
    /** Unread activities: the Activities tab's count. */
    unReadActivityCount: number;
    funcSetInboxItems: () => Promise<void>;
}

export const useInboxManagement = (): InboxManagementState => {
    const [inboxItems, setInboxItems] = useState<InboxItemProps[]>([]);
    const [unReadInboxItemCount, setUnReadInboxItemCount] = useState<number>(0);
    const [unReadRequestCount, setUnReadRequestCount] = useState<number>(0);
    const [unReadActivityCount, setUnReadActivityCount] = useState<number>(0);

    const countUnReadInboxItem = (inboxItems: InboxItemProps[]): number => {
        return inboxItems.reduce<number>((acc, item) => {
            if (item.isRead === false) {
                acc += 1;
            }
            return acc;
        }, 0);
    };

    const funcSetInboxItems = async () => {
        const inboxItems: InboxItemProps[] = await popInboxItems();
        if (inboxItems) {
            setInboxItems(inboxItems);
        }
    };

    useEffect(() => {
        funcSetInboxItems();
    }, []);

    useEffect(() => {
        // Each tab counts its own half, split by the same rule that put the item
        // there (`isActivityItemType`) rather than by a second list that can
        // fall behind; the sidebar, bottom bar and app icon show the sum.
        // Activities used to be left out because nothing ever marked them read,
        // so the number could only grow; since MIP-1627 looking at one does,
        // and so does "Mark all as read".
        const requests = countUnReadInboxItem(
            inboxItems.filter((item) => !isActivityItemType(item.itemType))
        );
        const activities = countUnReadInboxItem(
            inboxItems.filter((item) => isActivityItemType(item.itemType))
        );
        setUnReadRequestCount(requests);
        setUnReadActivityCount(activities);
        setUnReadInboxItemCount(requests + activities);
    }, [inboxItems]);

    return {
        inboxItems,
        setInboxItems,
        unReadInboxItemCount,
        setUnReadInboxItemCount,
        unReadRequestCount,
        unReadActivityCount,
        funcSetInboxItems,
    };
};
