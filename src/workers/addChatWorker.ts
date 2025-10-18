import { STORES } from "../db/conf";
import { ChatRepository, ChatRepositoryFactory } from "../db/repositories";
import { AllChatProps } from "../types/chat";

self.onmessage = async (event) => {
    const chat: AllChatProps = event.data.chat;
    const chatType: number = event.data.chatType;

    if (chatType === 1) {
        const dmChatRepo = ChatRepositoryFactory.createDMChatRepository();
        await dmChatRepo.put(chat);
    } else if (chatType === 2) {
        const gmChatRepo = ChatRepositoryFactory.createGMChatRepository();
        await gmChatRepo.put(chat);
    } else if (chatType === 3) {
        const pmChatRepo = ChatRepositoryFactory.createPMChatRepository();
        await pmChatRepo.put(chat);
    }

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
