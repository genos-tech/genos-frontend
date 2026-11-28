import { useEffect, useSyncExternalStore } from "react";

import { channelService } from "../../../services/channel/channelService";
import { ChannelMessagePins } from "../../../types/channel";
import { isV3Uuid } from "../../../utils/legacyId";

/** What the service holds for a chat's pinned messages. `undefined` until read, and for good
 *  against a server without the feature. Reads nothing itself. */
export const useHeldMessagePins = (channelId: string): ChannelMessagePins | undefined =>
    useSyncExternalStore(channelService.subscribe, () =>
        channelService.getSnapshot().messagePinsByChannel?.get(channelId)
    );

/** The same, reading the list each time the chat is opened (MIP-2487). */
export const useChannelMessagePins = (channelId: string): ChannelMessagePins | undefined => {
    useEffect(() => {
        if (isV3Uuid(channelId)) void channelService.fetchMessagePins(channelId);
    }, [channelId]);
    return useHeldMessagePins(channelId);
};
