import { ChatRepositoryFactory } from "../repositories";
import { MessageProps } from "../../types/chat";

self.onmessage = async (event) => {
    const message: MessageProps = event.data.message;
    const chatType: number = event.data.chatType;

    if (chatType === 1) {
        const dmMessageRepo = ChatRepositoryFactory.createDMMessageRepository();
        await dmMessageRepo.put(message);
    } else if (chatType === 2) {
        const gmMessageRepo = ChatRepositoryFactory.createGMMessageRepository();
        await gmMessageRepo.put(message);
    } else if (chatType === 3) {
        const pmMessageRepo = ChatRepositoryFactory.createPMMessageRepository();
        await pmMessageRepo.put(message);
    }

    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
