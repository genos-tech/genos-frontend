import { channelService } from "../../../services/channel/channelService";
import { ChannelKind } from "../../../types/channel";

/**
 * Soft-delete a top-level chat message via the v3 channelService.
 *
 * Replaces the per-type axios PUT path (`/dm/message/`, `/gm/message/`,
 * `/pm/message/`, `/mdm/message/`) with a single channelService call.
 * The v3 `message.delete` emit:
 *
 *   1. Acks back ok/err synchronously (caller awaits).
 *   2. Server broadcasts `message.deleted` on the channel room; the
 *      open chat's `useChatManagement` live-update subscription picks
 *      up the change and patches `currentMainChat.messages` /
 *      `currentSubChat.messages` automatically.
 *   3. channelService persists the soft-delete to v3 IDB (sets
 *      `deletedAt`).
 *
 * The legacy `accessToken` parameter is unused on the v3 path
 * (channelService manages its own socket auth via the connect-time
 * handshake). Kept on the signature for back-compat with the modal's
 * existing call site.
 *
 * `chatType` is the legacy integer kind code (1=DM, 2=GM, 3=PM, 4=MDM)
 * which maps 1:1 to `ChannelKind`.
 */
export const deleteMessage = async (
    _accessToken: string | null,
    chatType: number,
    channelId: string,
    messageUuid: string,
    setErrorMessage?: (value: string) => void
): Promise<void> => {
    if (!messageUuid) {
        // Defensive: a missing v3 UUID means the caller is still
        // sourcing legacy MessageProps without `messageIdWithChatId`.
        // Surface to the user rather than silently swallowing.
        console.warn("[deleteMessage] missing v3 messageUuid — no-op");
        setErrorMessage?.("Could not delete: message id unavailable.");
        return;
    }
    try {
        await channelService.deleteMessage(messageUuid, channelId, chatType as ChannelKind);
    } catch (e) {
        console.error("[deleteMessage] channelService.deleteMessage failed:", e);
        setErrorMessage?.("Failed to delete message.");
    }
};
