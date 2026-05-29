import { UserProps } from "../../../types/admin";
import { ChatProps, MessageProps } from "../../../types/chat";

// PUNCH LIST (v3 chatId migration): callers (see `moveToChat.ts`) still
// pass `chatId: number` because the chat-discovery / join path is
// legacy. `ChatProps.chatId` and `lastReadMessageId` are `string` post-
// flip, so we stringify at this construction boundary. `""` is the new
// "no last-read" sentinel (replaces legacy `-1`).
// Keys sorted alphabetically per `sort-keys` (case-insensitive).
export const defineNewChat = (
    chatId: number,
    chatName: string,
    chatType: number,
    dmPartnerUser: UserProps,
    messages: MessageProps[],
    isPrivate: boolean,
    profileImagePath?: string
) => {
    const lastMsg = messages.length > 0 ? messages[messages.length - 1] : undefined;
    const newChat: ChatProps = {
        chatId: String(chatId),
        chatName: chatName,
        chatType: chatType,
        dmPartnerUser: dmPartnerUser,
        isPrivate: isPrivate,
        lastReadMessageId: lastMsg?.messageId != null ? String(lastMsg.messageId) : "",
        latestMessage: lastMsg as MessageProps,
        latestMessageText: lastMsg?.contentText ?? "",
        messages: messages,
        profileImagePath: profileImagePath,
        TSLastMessage: lastMsg?.tsSent ?? "",
    };
    return newChat;
};
