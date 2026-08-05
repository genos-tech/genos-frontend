import { useEffect, useState } from "react";

import { popInboxItems } from "../../features/inbox/services/popInboxItems";
import { isActivityItemType } from "../../features/inbox/utils/inboxItemTypes";
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
        // The badge sits on the REQUESTS tab, so it counts unread REQUESTS
        // only. Anything on the Activities tab — a notice, the digest, a
        // message reminder — is excluded by the same rule that put it
        // there, rather than by a second list that can fall behind.
        setUnReadInboxItemCount(
            countUnReadInboxItem(inboxItems.filter((item) => !isActivityItemType(item.itemType)))
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
