import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { channelService } from "../../../services/channel/channelService";
import { emitRequestError } from "../../../services/requestErrorNotifier";
import { UserProps } from "../../../types/admin";
import { ChatProps } from "../../../types/chat";
import { isV3Uuid } from "../../../utils/legacyId";
import { getFirstLine } from "../utils/common";

/**
 * Post a chat message via the v3 channelService.
 *
 * Replaces the legacy socket-emit + manual optimistic state path. The
 * v3 path is:
 *
 *   1. `channelService.send(channelId, content, {bodyText})` enqueues
 *      a `PendingMessage` with a fresh `correlation_id`, emits
 *      `message.send` on the `/v3` namespace, and returns a Promise
 *      that resolves with the server-confirmed `Message` (or rejects
 *      with a `ChannelServiceError`).
 *
 *   2. On ack, channelService.handleMessageCreated upserts the row in
 *      `_messages` and notifies React. The live-update subscription
 *      on `useChatManagement` (added in the same Track D session)
 *      picks up the change for the current main / sub chat and
 *      patches `currentMainChat.messages` / `currentSubChat.messages`
 *      automatically — no `setCurrentChat` call needed here.
 *
 *   3. The sidebar re-sorts from the same store change: the echo/ack
 *      bumps the channel's `latestMessage`, and the chat-list
 *      subscription in useChatManagement re-derives on the resulting
 *      `channelsVersion` bump — no explicit list refresh needed.
 *
 * Unused params (`socket`, `useCM`, `setCurrentChat`) are kept on the
 * signature for back-compat with existing callers (MainChatPaneHeader,
 * bnChatEditor). They were load-bearing on the legacy path; on v3 the
 * pending queue + live subscription handle the work they did.
 */
export const sendChatMessage = async ({
    chat,
    content,
    myself,
}: {
    socket: Socket;
    chat: ChatProps;
    // `any[]` matches the BlockNote editor's raw block array.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any[];
    myself: UserProps;
    useCM: ChatManagementState;
    setCurrentChat: (chat: ChatProps) => void;
}): Promise<boolean> => {
    const bodyText = getFirstLine(content[0]);
    // Fail fast on stale legacy-integer chatIds. A non-UUID chatId
    // would land at `/api/v3/channels/{int}/messages/` which Django's
    // `<uuid:channel_id>` URL pattern rejects with a 404 — surfaces
    // server-side as an opaque BackendError trace. Better to refuse
    // the send here with a clear console hint pointing at the v3
    // backfill / fresh-start path.
    if (!isV3Uuid(chat.chatId)) {
        console.error(
            `[sendChatMessage] chat.chatId is not a v3 UUID (got ${JSON.stringify(chat.chatId)}). ` +
                "This usually means the chat was loaded from a legacy path with no v3 Channel " +
                "mirror. Run the backfill (`backfill_v3_channels`) or wipe legacy data + reload."
        );
        emitRequestError("messageSendFailed");
        return false;
    }
    try {
        // `echo` renders the message in the pane IMMEDIATELY (optimistic
        // local row keyed by the correlation id) instead of after the
        // socket→Flask→Django ack round-trip; channelService swaps it
        // for the server row on ack and removes it if the send fails
        // (bnChatEditor then restores the composer text).
        await channelService.send(chat.chatId, content, {
            bodyText,
            echo: {
                sender: {
                    avatarImgPath: myself.avatarImgPath || null,
                    isSystemUser: false,
                    userEmail: myself.userEmail,
                    userId: myself.userId,
                    userName: myself.userName,
                },
            },
        });
    } catch (e) {
        // The send failed — server rejected it, the ack timed out, or the
        // socket server couldn't reach Django. channelService keeps the
        // message on its pending queue (retried on reconnect), but this
        // pane doesn't render that queue, so we surface a toast and report
        // failure to the caller — bnChatEditor restores the text to the
        // composer so it isn't lost.
        console.error("[sendChatMessage] channelService.send failed:", e);
        emitRequestError("messageSendFailed");
        return false;
    }
    // No explicit chat-list refresh here anymore: the optimistic echo /
    // ack path bumps the channel's `latestMessage` in the store, and the
    // `channelsVersion`-gated subscription in useChatManagement re-sorts
    // the sidebar from that — the old `funcSetAllChats()` added a full
    // REST `GET /channels/` + a second list re-derive to every send.
    return true;
};
