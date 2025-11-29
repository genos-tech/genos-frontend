import { ChatService } from "../services/chat.service";

self.onmessage = async (event) => {
    const chatType: number = event.data.chatType;

    if (chatType !== undefined && chatType !== null) {
        let latestChat = null;
        const chatService = new ChatService();

        if (chatType === 1) {
            latestChat = await chatService.getLatestDMChat();
        } else if (chatType === 2) {
            latestChat = await chatService.getLatestGMChat();
        } else if (chatType === 3) {
            latestChat = await chatService.getLatestPMChat();
        }

        if (latestChat) {
            self.postMessage(latestChat);
        } else {
            self.postMessage(null);
        }
    } else {
        self.postMessage(null);
    }

    self.close(); // Terminates itself
};

export {};
