// Marks an Inbox activity read once the member has looked at it (MIP-1292, widened by MIP-1627).
// The look is decided in `reportReadScheduler`; this only says which items take part and what to
// send.
//
// Every item of the Activities half takes part: a notice (0), the Genos digest (6), a message or
// to-do reminder (9) and a Genos report (10). A request (1-5, 7, 8) never does: somebody is
// waiting on it, and looking at it is not answering it. The digest used to be left out because
// the email digest lists unread type-6 items; marking it read once seen is the point now, so a
// digest already opened in the app no longer comes round again by email.
//
// A card the member marked unread by hand is held (`readHold`) and takes no part until they read
// it by hand again.

import { useCallback, useRef } from "react";

import { useAuth } from "../../../context/AuthContext";
import type { InboxItemProps } from "../../../types/common";
import { isHeldUnread, readKey } from "../readHold";
import { watchUntilRead } from "../reportReadScheduler";
import { markInboxRead } from "../services/markInboxRead";
import { isActivityItemType } from "../utils/inboxItemTypes";

export const isMarkedReadOnView = (itemType: number): boolean => isActivityItemType(itemType);

type Args = Pick<InboxItemProps, "itemId" | "itemType" | "isRead"> & {
    userId: string;
    teamId: string;
    /** Called after the server took it, so the list (and the counts) re-read the stored rows. */
    onRead?: () => void;
};

/** A ref callback for the card's root element; undefined when the item takes no part. */
export const useMarkReadOnView = ({ itemId, itemType, isRead, userId, teamId, onRead }: Args) => {
    const { accessToken } = useAuth();
    // Read at send time: the token may have been refreshed since the card rendered.
    const tokenRef = useRef(accessToken);
    tokenRef.current = accessToken;
    const onReadRef = useRef(onRead);
    onReadRef.current = onRead;
    const key = readKey(userId, teamId, itemId);
    const eligible =
        isMarkedReadOnView(itemType) &&
        !isRead &&
        Boolean(userId) &&
        Boolean(teamId) &&
        !isHeldUnread(key);
    const watch = useCallback(
        (el: HTMLElement | null) => {
            if (!el) return;
            return watchUntilRead(el, key, async () => {
                const ok = await markInboxRead(tokenRef.current, teamId, itemId);
                if (ok) onReadRef.current?.();
                return ok;
            });
        },
        [key, teamId, itemId]
    );
    return eligible ? watch : undefined;
};
