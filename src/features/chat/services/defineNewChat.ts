import { MessageProps, ChatProps } from "../../../types/chat";

export const defineNewChat = (
    chatId: number,
    chatName: string,
    isDm: boolean,
    dmPartnerUserId: string | null,
    messages: MessageProps[]
) => {
    const newChat: ChatProps = {
        chatId: chatId,
        chatName: chatName,
        isDm: isDm,
        dmPartnerUserId: isDm ? dmPartnerUserId : null,
        unread: false,
        messages: messages,
        latestMessage: messages[messages.length - 1],
        latestMessageText: messages[messages.length - 1].contentText,
        TSLastMessage: messages[messages.length - 1].tsSent,
    };
    return newChat
}
