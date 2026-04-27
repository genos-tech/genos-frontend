import { UserProps } from "../../../types/admin";
import { ChatProps, MessageProps } from "../../../types/chat";

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
        chatId: chatId,
        chatName: chatName,
        chatType: chatType,
        dmPartnerUser: dmPartnerUser,
        lastReadMessageId: lastMsg?.messageId ?? -1,
        messages: messages,
        latestMessage: lastMsg as MessageProps,
        latestMessageText: lastMsg?.contentText ?? "",
        TSLastMessage: lastMsg?.tsSent ?? "",
        isPrivate: isPrivate,
        profileImagePath: profileImagePath,
    };
    return newChat;
};
