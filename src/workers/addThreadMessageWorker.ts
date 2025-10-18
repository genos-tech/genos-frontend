import { ChatService } from "../db/services/chat.service";
import { ThreadMessageProps } from "../types/chat";

self.onmessage = async (event) => {
    const message: ThreadMessageProps = event.data.threadMessage;
    const chatType: number = event.data.chatType;

    const chatService = new ChatService();

    if (chatType === 1) {
        await chatService.addDMThreadMessage(message);
    } else if (chatType === 2) {
        await chatService.addGMThreadMessage(message);
    } else if (chatType === 3) {
        await chatService.addPMThreadMessage(message);
    }

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
