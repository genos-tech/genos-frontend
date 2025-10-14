import { getLatestDMChat, getLatestGMChat, getLatestPMChat } from "../db/crud";

self.onmessage = async (event) => {
    const chatType: number = event.data.chatType;

    if (chatType !== undefined && chatType !== null) {
        let latestChat = null;

        if (chatType === 1) {
            latestChat = await getLatestDMChat();
        } else if (chatType === 2) {
            latestChat = await getLatestGMChat();
        } else if (chatType === 3) {
            latestChat = await getLatestPMChat();
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
