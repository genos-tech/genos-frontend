import { useEffect, useState } from "react";

import { popInboxItems } from "../../features/inbox/services/popInboxItems";
import { InboxItemProps } from "../../types/common";

export interface InboxManagementState {
    inboxItems: InboxItemProps[];
    setInboxItems: (items: InboxItemProps[]) => void;
    unReadInboxItemCount: number;
    setUnReadInboxItemCount: (count: number) => void;
    funcSetInboxItems: () => Promise<void>;
}

export const useInboxManagement = (): InboxManagementState => {
    const [inboxItems, setInboxItems] = useState<InboxItemProps[]>([]);
    const [unReadInboxItemCount, setUnReadInboxItemCount] = useState<number>(0);

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
        // The badge sits on the REQUESTS tab, so it counts unread request
        // items only (item_type 1-5) — not activity notices (0) and not
        // the Genos digest (6), which lives on the Activities tab.
        setUnReadInboxItemCount(
            countUnReadInboxItem(
                inboxItems.filter((item) => item.itemType > 0 && item.itemType !== 6)
            )
        );
    }, [inboxItems]);

    return {
        inboxItems,
        setInboxItems,
        unReadInboxItemCount,
        setUnReadInboxItemCount,
        funcSetInboxItems,
    };
};
