import { ChatService } from "../services";
import { AllChatProps } from "../../types/chat";

self.onmessage = async (event) => {
    const chatService = new ChatService();
    const dmChats: AllChatProps[] = await chatService.getDMChats();
    const gmChats: AllChatProps[] = await chatService.getGMChats();
    const pmChats: AllChatProps[] = await chatService.getPMChats();

    // Sort messages by TSLastMessage in desc
    const sortedAllChats = [...dmChats, ...gmChats, ...pmChats].sort((a, b) => {
        return new Date(b.TSLastMessage).getTime() - new Date(a.TSLastMessage).getTime();
    });

    self.postMessage(sortedAllChats);

    self.close(); // Terminates itself
};

export {};
