import { STORES } from "../db/conf";
import { ChatRepository, ChatRepositoryFactory } from "../db/repositories";
import { ChatMessage } from "../db/types";
import { MessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const message: MessageProps = event.data.message;
    const chatType: number = event.data.chatType;

    // Convert MessageProps to ChatMessage format
    const chatMessage: ChatMessage = {
        messageIdWithChatId:
            message.messageIdWithChatId || `${message.chatId}-${message.messageId}`,
        chatId: message.chatId,
        messageId: message.messageId,
        content:
            typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content),
        timestamp: new Date(message.tsSent).getTime(),
        userId: message.sender.userId,
        userName: message.sender.userName,
    };

    if (chatType === 1) {
        const dmMessageRepo = ChatRepositoryFactory.createDMMessageRepository();
        await dmMessageRepo.put(chatMessage);
    } else if (chatType === 2) {
        const gmMessageRepo = ChatRepositoryFactory.createGMMessageRepository();
        await gmMessageRepo.put(chatMessage);
    } else if (chatType === 3) {
        const pmMessageRepo = ChatRepositoryFactory.createPMMessageRepository();
        await pmMessageRepo.put(chatMessage);
    }

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
