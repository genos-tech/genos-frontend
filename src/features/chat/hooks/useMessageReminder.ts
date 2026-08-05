import { useSyncExternalStore } from "react";

import { channelService } from "../../../services/channel/channelService";
import { MessageReminder } from "../../../types/channel";

/**
 * The pending reminder on a message, or null.
 *
 * Its own subscription so a bubble, its More menu, and the flagged-list row
 * can each say "reminder set for 15:30" without threading the reminder
 * through the props of everything in between.
 */
export const useMessageReminder = (messageId?: string | null): MessageReminder | null => {
    const snapshot = useSyncExternalStore(
        channelService.subscribe,
        channelService.getSnapshot,
        channelService.getSnapshot
    );
    if (!messageId) return null;
    return snapshot.reminderByMessageId.get(messageId) ?? null;
};
