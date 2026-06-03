import { channelService } from "../../../services/channel/channelService";
import { ChannelKind } from "../../../types/channel";

/**
 * Soft-delete a thread reply via the v3 channelService.
 *
 * v3 unifies top-level messages and thread replies in one Message
 * model — they're differentiated only by `isThreadReply` + `threadRootId`.
 * That means `channelService.deleteMessage` is the same call regardless
 * of whether the target is a top-level row or a thread reply; the
 * separate `deleteThreadMessage` service is kept only for the existing
 * modal's call-site clarity.
 *
 * Behavior mirrors `deleteMessage`: ack-synced delete emit, server
 * broadcasts `message.deleted` to the channel room, the open chat's
 * live-update subscription patches the visible thread / pane.
 *
 * `threadId` is the legacy integer thread root id, no longer load-
 * bearing on the v3 path (the message UUID is the unique identifier)
 * but kept on the signature for back-compat with the modal call.
 */
export const deleteThreadMessage = async (
    _accessToken: string | null,
    chatType: number,
    channelId: string,
    _threadId: number,
    messageUuid: string,
    setErrorMessage?: (value: string) => void
): Promise<void> => {
    if (!messageUuid) {
        setErrorMessage?.("Could not delete: message id unavailable.");
        return;
    }
    try {
        await channelService.deleteMessage(messageUuid, channelId, chatType as ChannelKind);
    } catch (e) {
        console.error("[deleteThreadMessage] channelService.deleteMessage failed:", e);
        setErrorMessage?.("Failed to delete message.");
    }
};
