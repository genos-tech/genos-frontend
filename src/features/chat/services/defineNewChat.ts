import { UserProps } from "../../../types/admin";
import { ChatProps, MessageProps } from "../../../types/chat";

// `chatId` widened to `string | number` for the v3 migration. v3
// callers (post-Track-D `moveToDMChat` / `moveToGMChat`) resolve the
// v3 UUID string and pass it through; legacy callers still hand in
// integers. `String(chatId)` is idempotent over both — UUIDs stringify
// to themselves. `""` is the "no last-read" sentinel (replaces legacy `-1`).
// Keys sorted alphabetically per `sort-keys` (case-insensitive).
export const defineNewChat = (
    chatId: string | number,
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
