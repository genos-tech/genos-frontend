import { ChatService } from "../db/services/chat.service";
import { ThreadMessage } from "../db/types";
import { ThreadMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const message: ThreadMessageProps = event.data.threadMessage;
    const chatType: number = event.data.chatType;

    // Convert ThreadMessageProps to ThreadMessage format
    const threadMessage: ThreadMessage = {
        messageIdWithChatIdAndThreadId: message.messageIdWithChatIdAndThreadId,
        chatId: message.chatId,
        threadId: message.threadId,
        messageId: message.messageId,
        content:
            typeof message.content === "string"
                ? message.content
                : JSON.stringify(message.content),
        timestamp: new Date(message.tsSent).getTime(),
        userId: message.sender.userId,
        userName: message.sender.userName,
    };

    const chatService = new ChatService();

    if (chatType === 1) {
        await chatService.addDMThreadMessage(threadMessage);
    } else if (chatType === 2) {
        await chatService.addGMThreadMessage(threadMessage);
    } else if (chatType === 3) {
        await chatService.addPMThreadMessage(threadMessage);
    }

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
