import loadDMHistory from '../components/loadFromBackend/loadDMHistory';
import { UserProps, ChatProps, MessageProps } from "../types";
import { STORES } from "../components/indexedDBUtils/conf";
import {
    clearStore,
    addData,
    miniBatchInsertMessages
} from "../components/indexedDBUtils/crud";

const BATCH_SIZE = 100;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.DM_CHATS)

    // Load data from backend
    const dmHistory: ChatProps[] = await loadDMHistory({
        userId: myself.userId,
        accessToken: accessToken
    });

    for (let i = 0; i < dmHistory.length; i += 1) {
        const dmChat: ChatProps = dmHistory[i]

        // Insert chat 
        const newChatData = {
            storeName: STORES.DM_CHATS,
            data: {
                chatId: dmChat.chatId,
                chatName: dmChat.chatName,
                unread: dmChat.unread,
                isDm: true,
                dmPartnerUserId: dmChat.dmPartnerUserId,
                latestMessage: dmChat.latestMessage,
                TSLastMessage: dmChat.TSLastMessage
            }
        }
        await addData(newChatData)

        // Insert messages by mini-batch
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
