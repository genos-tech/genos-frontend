import { useEffect, useState } from "react";

import { InboxItemProps } from "../../../types/common";
import { isActivityItemType } from "../utils/inboxItemTypes";

export const useInboxItems = (inboxItems: InboxItemProps[]) => {
    const [activityInboxItems, setActivityInboxItems] = useState<InboxItemProps[]>([]);
    const [requestInboxItems, setRequestInboxItems] = useState<InboxItemProps[]>([]);

    useEffect(() => {
        setActivityInboxItems(inboxItems.filter((item) => isActivityItemType(item.itemType)));
        setRequestInboxItems(inboxItems.filter((item) => !isActivityItemType(item.itemType)));
    }, [inboxItems]);

    return {
        activityInboxItems,
        requestInboxItems,
    };
};
