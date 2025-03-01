import { STORES } from "../components/indexedDBUtils/conf";
import { getAllDataWithIndex } from "../components/indexedDBUtils/crud";

self.onmessage = async (event) => {
    const chatEmail: string = event.data.chatEmail;
    const threadId: string = event.data.threadId;

    if (chatEmail !== undefined && threadId !== undefined) {
        const dmThreadMessages = await getAllDataWithIndex({
            storeName: STORES.DM_THREAD_MESSAGES,
            chatEmail: chatEmail,
            threadId: threadId,
        })

        // Sort messages by tsSent in ascending order
        const sortedMessages = [...dmThreadMessages].sort((a, b) => {
            return Number(a.messageId) - Number(b.messageId);
        });

        self.postMessage(sortedMessages);
    } else {
        self.postMessage([]);
    }
};

export { };
