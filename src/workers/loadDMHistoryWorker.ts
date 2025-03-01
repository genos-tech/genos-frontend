import loadDMHistory from '../components/loadFromBackend/loadDMHistory';
import { UserProps, ChatProps, MessageProps } from "../types";
import { STORES } from "../components/indexedDBUtils/conf";
import {
    addData,
    miniBatchInsertMessages
} from "../components/indexedDBUtils/crud";
import { initDB } from "../components/indexedDBUtils/schema";


const BATCH_SIZE = 2;

self.onmessage = async (event) => {
    // deleteIndexedDB()

    // // Example usage
    // getAllStores('myDatabase').then(stores => {
    //     console.log('Stores:', stores);
    // }).catch(error => {
    //     console.error('Error fetching stores:', error);
    // });

    const db = await initDB();

    const myself: UserProps = event.data;

    // Load data from backend
    const dmHistory: ChatProps[] = await loadDMHistory({
        userEmail: myself.userEmail
    });

    // console.log("Num of DM chats:", dmHistory.length)
    for (let i = 0; i < dmHistory.length; i += 1) {
        const dmChat: ChatProps = dmHistory[i]

        // Insert chat 
        const newChatData = {
            storeName: STORES.DM_CHATS,
            chatEmail: dmChat.chatEmail,
            data: {
                chatEmail: dmChat.chatEmail,
                chatName: dmChat.chatName,
                unread: dmChat.unread,
                isDm: true,
                latestMessage: dmChat.latestMessage,
                TSLastMessage: dmChat.TSLastMessage
            }
        }
        await addData(newChatData)

        // Insert messages by mini-batch
        // console.log("Num of DM inserting messages:", dmChat.messages.length)
        for (let i = 0; i < dmChat.messages.length; i += BATCH_SIZE) {
            const miniBatchMessages: MessageProps[] = dmChat.messages.slice(i, i + BATCH_SIZE);
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
