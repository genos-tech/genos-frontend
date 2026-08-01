import { useEffect, useState } from "react";

import { InboxItemProps } from "../../../types/common";

export const useInboxItems = (inboxItems: InboxItemProps[]) => {
    const [activityInboxItems, setActivityInboxItems] = useState<InboxItemProps[]>([]);
    const [requestInboxItems, setRequestInboxItems] = useState<InboxItemProps[]>([]);

    useEffect(() => {
        // Activities = things that HAPPENED (activity notices, the Genos
        // digest); Requests = things awaiting a decision (item_type 1-5).
        // The digest (6) is not a request — it has no approve/reject.
        setActivityInboxItems(
            inboxItems.filter((item) => item.itemType === 0 || item.itemType === 6)
        );
        setRequestInboxItems(
            inboxItems.filter((item) => item.itemType !== 0 && item.itemType !== 6)
        );
    }, [inboxItems]);

    return {
        activityInboxItems,
        requestInboxItems,
    };
};
