import { ChatService } from "../db/services/chat.service";

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const chatType: number = event.data.chatType;

    let isKnown: boolean;
    const chatService = new ChatService();
    if (chatType === 1) {
        isKnown = await chatService.isKnownDMChat(chatId);
    } else if (chatType === 2) {
        isKnown = await chatService.isKnownGMChat(chatId);
    } else if (chatType === 3) {
        isKnown = await chatService.isKnownPMChat(chatId);
    } else {
        isKnown = false;
    }

    self.postMessage(isKnown);

    self.close(); // Terminates itself
};

export {};
