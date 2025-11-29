import { useEffect, useState } from "react";

import { InboxItemProps } from "../../../types/common";

export const useInboxItems = (inboxItems: InboxItemProps[]) => {
    const [activityInboxItems, setActivityInboxItems] = useState<InboxItemProps[]>([]);
    const [requestInboxItems, setRequestInboxItems] = useState<InboxItemProps[]>([]);

    useEffect(() => {
        setActivityInboxItems(inboxItems.filter((item) => item.itemType === 0));
        setRequestInboxItems(inboxItems.filter((item) => item.itemType !== 0));
    }, [inboxItems]);

    return {
        activityInboxItems,
        requestInboxItems,
    };
};
