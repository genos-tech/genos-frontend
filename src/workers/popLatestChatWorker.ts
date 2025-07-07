import { getLatestDMChat, getLatestGMChat } from "../db/crud";

self.onmessage = async (event) => {
    const isDm: boolean = event.data.isDm;
    const chatType: number = event.data.chatType;

    if (isDm !== undefined && isDm !== null) {
        var latestChat = null;

        if (isDm) {
            latestChat = await getLatestDMChat();
        } else {
            latestChat = await getLatestGMChat();
        }

        if (latestChat) {
            self.postMessage(latestChat);
        } else {
            self.postMessage(null);
        }
    } else {
        self.postMessage(null);
    }
};

export {};
