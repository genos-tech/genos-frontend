import { checkIsKnownDMChat, checkIsKnownGMChat } from "../components/indexedDBUtils/utils";

self.onmessage = async (event) => {
    const chatEmail: string = event.data.chatEmail;
    const isDm: boolean = event.data.isDm;
    var isKnown: boolean
    if (isDm) {
        isKnown = await checkIsKnownDMChat(chatEmail);
    } else {
        isKnown = await checkIsKnownGMChat(chatEmail);
    }
    self.postMessage(isKnown);
};

export { };
