import loadSpecificGMHistory from '../components/loadFromBackend/loadSpecificGMHistory';
import { ChatProps } from "../types";
import { STORES } from "../components/indexedDBUtils/conf";
import {
    addData,
    miniBatchInsertMessages,
} from "../components/indexedDBUtils/crud";


const BATCH_SIZE = 2;

self.onmessage = async (event) => {
    // Load data from backend
    const gmHistory: ChatProps[] = await loadSpecificGMHistory(event.data);

    console.log("Num of Specific GM chats:", gmHistory.length)
    for (let i = 0; i < gmHistory.length; i += 1) {
        const gmChat: ChatProps = gmHistory[i]

        // Insert chat 
        await addData({
            storeName: STORES.GM_CHATS,
            chatEmail: gmChat.chatEmail,
            data: {
                chatEmail: gmChat.chatEmail,
                chatName: gmChat.chatName,
                unread: gmChat.unread,
                TSLastMessage: gmChat.TSLastMessage
            }
        })

        // Insert messages by mini-batch
        console.log("Num of Specific GM inserting messages:", gmChat.messages.length)
        for (let i = 0; i < gmChat.messages.length; i += BATCH_SIZE) {
            const miniBatchMessages = gmChat.messages.slice(i, i + BATCH_SIZE);
            await miniBatchInsertMessages({
                storeName: STORES.GM_MESSAGES,
                miniBatchMessages: miniBatchMessages
            });
        }
    }

    // Send finish a message
    self.postMessage("done");
};

export { };
