import { checkIsKnownDMChat, checkIsKnownGMChat, checkIsKnownPMChat } from "../db/utils";

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const chatType: number = event.data.chatType;

    var isKnown: boolean;
    if (chatType === 1) {
        isKnown = await checkIsKnownDMChat(chatId);
    } else if (chatType === 2) {
        isKnown = await checkIsKnownGMChat(chatId);
    } else if (chatType === 3) {
        isKnown = await checkIsKnownPMChat(chatId);
    } else {
        isKnown = false;
    }

    self.postMessage(isKnown);
};

export {};
