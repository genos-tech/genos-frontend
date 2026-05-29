import { Socket } from "socket.io-client";

import { ChatManagementState } from "../../../hooks/chats/useChatManagement";
import { channelService } from "../../../services/channel/channelService";
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
 *   3. `useCM.funcSetAllChats()` refreshes the chat-list ordering so
 *      the just-active channel floats to the top. (The chat list
 *      itself is also v3-backed by `loadV3Chats`.)
 *
 * Unused params (`socket`, `myself`, `setCurrentChat`) are kept on the
 * signature for back-compat with existing callers (MainChatPaneHeader,
 * bnChatEditor). They were load-bearing on the legacy path; on v3 the
 * pending queue + live subscription handle the work they did.
 */
export const sendChatMessage = async ({
    chat,
    content,
    useCM,
}: {
    socket: Socket;
    chat: ChatProps;
    // `any[]` matches the BlockNote editor's raw block array.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    content: any[];
    myself: UserProps;
    useCM: ChatManagementState;
    setCurrentChat: (chat: ChatProps) => void;
}): Promise<void> => {
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
        return;
    }
    try {
        await channelService.send(chat.chatId, content, { bodyText });
    } catch (e) {
        // channelService already records the failure on the pending
        // entry; the dev panel can surface it. Re-throwing here would
        // bubble into the BlockNote editor's `await`, which has no
        // user-facing recovery path, so swallow it here (mirrors the
        // legacy code's silent-on-error contract for editor sends).
        console.error("[sendChatMessage] channelService.send failed:", e);
        return;
    }
    // Refresh the chat-list so the just-active channel re-sorts to
    // top. The live-update subscription keeps the open pane in sync;
    // this only catches the sidebar.
    await useCM.funcSetAllChats();
};
