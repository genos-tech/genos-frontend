import { STORES } from "../components/indexedDBUtils/conf";
import { getAllDataWithIndex } from "../components/indexedDBUtils/crud";

self.onmessage = async (event) => {
    const chatEmail: string = event.data.chatEmail;
    const dmMessages = await getAllDataWithIndex({
        storeName: STORES.DM_MESSAGES,
        chatEmail: chatEmail
    })
    
    // Sort messages by tsSent in ascending order
    const sortedMessages = [...dmMessages].sort((a, b) => {
        return Number(a.messageId) - Number(b.messageId);
    });

    self.postMessage(sortedMessages);
};

export { };
