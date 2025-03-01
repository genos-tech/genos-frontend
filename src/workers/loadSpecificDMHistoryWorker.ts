import loadSpecificDMHistory from '../components/loadFromBackend/loadSpecificDMHistory';
import { ChatProps } from "../types";
import { STORES } from "../components/indexedDBUtils/conf";
import {
    addData,
    miniBatchInsertMessages
} from "../components/indexedDBUtils/crud";


const BATCH_SIZE = 2;

self.onmessage = async (event) => {
    // Load data from backend
    const dmHistory: ChatProps[] = await loadSpecificDMHistory(event.data);

    console.log("Num of Specific DM chats:", dmHistory.length)
    for (let i = 0; i < dmHistory.length; i += 1) {
        const dmChat: ChatProps = dmHistory[i]

        // Insert chat 
        await addData({
            storeName: STORES.DM_CHATS,
            chatEmail: dmChat.chatEmail,
            data: {
                chatEmail: dmChat.chatEmail,
                chatName: dmChat.chatName,
                unread: dmChat.unread,
                TSLastMessage: dmChat.TSLastMessage
            }
        })

        // Insert messages by mini-batch
        console.log("Num of Specific DM inserting messages:", dmChat.messages.length)
        for (let i = 0; i < dmChat.messages.length; i += BATCH_SIZE) {
            const miniBatchMessages = dmChat.messages.slice(i, i + BATCH_SIZE);
            await miniBatchInsertMessages({
                storeName: STORES.DM_MESSAGES,
                miniBatchMessages: miniBatchMessages
            });
        }
    }

    // Send finish a message
    self.postMessage("done");
};

export { };
