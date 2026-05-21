import { Socket } from "socket.io-client";

import { ChatProps } from "../../../types/chat";

/**
 * Emit a plain-text chat message via the existing socket "message"
 * channel. Designed for programmatic callers (e.g. Quick Meet posting a
 * link, future task linkage actions) that need to inject a message
 * without going through the BlockNote editor in `bnChatEditor.tsx`.
 *
 * The server broadcasts the saved message back to all subscribers
 * including the sender (see `websocket-handlers.ts` line 91 comment),
 * so callers do NOT need to apply optimistic local updates — the
 * regular receive path will surface the message in the chat shortly.
 */
export const sendTextMessage = (socket: Socket | null, chat: ChatProps, text: string): void => {
    if (!socket || !chat) return;
    if (!text) return;
    // Mirror the BlockNote document shape `bnChatEditor` emits — a
    // paragraph block whose `content` is a styled-text run, PLUS a
    // trailing empty paragraph. The trailing block is mandatory:
    // `BnChatPreview` does `content.slice(0, -1)` when seeding the
    // preview editor (BlockNote requires a non-empty initialContent),
    // so messages with fewer than two blocks crash every consumer
    // that renders the preview (chat, inbox activity, etc.).
    // The renderer auto-linkifies bare URLs, so no `link` mark here.
    const message = [
        {
            type: "paragraph",
            content: [{ type: "text", text, styles: {} }],
        },
        {
            type: "paragraph",
            content: [],
        },
    ];
    socket.emit("message", {
        methodType: "POST",
        message,
        destCGName: chat.chatName,
        destCGId: chat.chatId,
        chatType: chat.chatType,
        dmPartnerUserId: chat.dmPartnerUser?.userId ?? null,
        taskId: null,
        taskStatus: null,
        systemUserId: null,
        messageIdForPut: null,
    });
};
