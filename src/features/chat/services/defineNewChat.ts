import { UserProps } from "../../../types/admin";
import { MessageProps, ChatProps } from "../../../types/chat";

export const defineNewChat = (
    chatId: number,
    chatName: string,
    chatType: number,
    dmPartnerUser: UserProps,
    messages: MessageProps[],
    isPrivate: boolean
) => {
    const newChat: ChatProps = {
        chatId: chatId,
        chatName: chatName,
        chatType: chatType,
        dmPartnerUser: dmPartnerUser,
        lastReadMessageId: messages[messages.length - 1].messageId,
        messages: messages,
        latestMessage: messages[messages.length - 1],
        latestMessageText: messages[messages.length - 1].contentText,
        TSLastMessage: messages[messages.length - 1].tsSent,
        isPrivate: isPrivate,
    };
    return newChat;
};
