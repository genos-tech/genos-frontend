import loadGMHistory from '../components/loadFromBackend/loadGMHistory';
import { UserProps, ChatProps, MessageProps } from "../types";
import { STORES } from "../components/indexedDBUtils/conf";
import {
    clearStore,
    addData,
    miniBatchInsertMessages,
} from "../components/indexedDBUtils/crud";


const BATCH_SIZE = 100;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.GM_CHATS)

    // Load data from backend
    const gmHistory: ChatProps[] = await loadGMHistory({
        userEmail: myself.userEmail,
        accessToken: accessToken
    });

    // console.log("Num of GM chats:", gmHistory.length)
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
                isDm: false,
                latestMessage: gmChat.latestMessage,
                TSLastMessage: gmChat.TSLastMessage
            }
        })

        // Insert messages by mini-batch
        // console.log("Num of GM inserting messages:", gmChat.messages.length)
        for (let i = 0; i < gmChat.messages.length; i += BATCH_SIZE) {
            const miniBatchMessages: MessageProps[] = gmChat.messages.slice(i, i + BATCH_SIZE);
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
