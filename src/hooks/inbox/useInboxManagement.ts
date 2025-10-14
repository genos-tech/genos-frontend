import { useState, useEffect } from "react";
import { InboxItemProps } from "../../types/common";
import { popInboxItems } from "../../features/inbox/services/popInboxItems";

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
        setUnReadInboxItemCount(
            countUnReadInboxItem(inboxItems.filter((item) => item.itemType > 0))
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
