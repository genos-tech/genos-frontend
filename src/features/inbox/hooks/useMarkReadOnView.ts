// Marks an Inbox item read once the member has looked at it (MIP-1292). The look is decided in
// `reportReadScheduler`; this only says which items take part and what to send.
//
// Only a Genos report (type 10). The digest (type 6) is left out on purpose: the email digest
// lists unread type-6 items, so marking it read would change that email, and nobody decided it.
// To include it, add 6 to MARK_READ_ON_VIEW.

import { useCallback, useRef } from "react";

import { useAuth } from "../../../context/AuthContext";
import type { InboxItemProps } from "../../../types/common";
import { watchUntilRead } from "../reportReadScheduler";
import { markInboxRead } from "../services/markInboxRead";
import { GENOS_REPORT_ITEM_TYPE } from "../utils/genosReport";

export const MARK_READ_ON_VIEW: ReadonlySet<number> = new Set([GENOS_REPORT_ITEM_TYPE]);

type Args = Pick<InboxItemProps, "itemId" | "itemType" | "isRead"> & {
    userId: string;
    teamId: string;
};

/** A ref callback for the card's root element; undefined when the item takes no part. */
export const useMarkReadOnView = ({ itemId, itemType, isRead, userId, teamId }: Args) => {
    const { accessToken } = useAuth();
    // Read at send time: the token may have been refreshed since the card rendered.
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;
    const eligible =
        MARK_READ_ON_VIEW.has(itemType) && !isRead && Boolean(userId) && Boolean(teamId);
    const watch = useCallback(
        (el: HTMLElement | null) => {
            if (!el) return;
            return watchUntilRead(el, `${userId}|${teamId}|${itemId}`, () =>
                markInboxRead(tokenRef.current, teamId, itemId)
            );
        },
        [userId, teamId, itemId]
    );
    return eligible ? watch : undefined;
};
