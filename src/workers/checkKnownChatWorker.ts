import { checkIsKnownDMChat, checkIsKnownGMChat } from "../db/utils";

self.onmessage = async (event) => {
    const chatId: number = event.data.chatId;
    const isDm: boolean = event.data.isDm;
    const chatType: number = event.data.chatType;

    var isKnown: boolean;
    if (isDm) {
        isKnown = await checkIsKnownDMChat(chatId);
    } else {
        isKnown = await checkIsKnownGMChat(chatId);
    }
    self.postMessage(isKnown);
};

export {};
