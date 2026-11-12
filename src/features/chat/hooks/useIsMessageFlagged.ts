import { useSyncExternalStore } from "react";

import { channelService } from "../../../services/channel/channelService";

/**
 * Is this message flagged for me (an ACTIVE flag: a done one is not)?
 *
 * Its own subscription, like `useMessageReminder`, for a bubble that is not a chat message and so
 * has no `isFlagged` on it: a task comment asks for its mirror message's flag (MIP-1434).
 * Returns a boolean, which `useSyncExternalStore` compares by value, so the bubble re-renders
 * only when ITS flag changes, not on every notify.
 */
export const useIsMessageFlagged = (messageId?: string | null): boolean =>
    useSyncExternalStore(
        channelService.subscribe,
        () => (messageId ? channelService.getSnapshot().flagByMessageId.has(messageId) : false),
        () => false
    );
