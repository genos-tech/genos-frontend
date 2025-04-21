import { getLatestDMChat } from "../db/crud";

self.onmessage = async (event) => {
    const latestDmChat = await getLatestDMChat()
    if (latestDmChat) {
        self.postMessage(latestDmChat);
    } else {
        self.postMessage(null);
    }
};

export { };
