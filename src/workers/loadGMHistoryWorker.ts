import { defaultDmPartner } from "../features/chat/services/constants";
import { loadGMHistory } from "../features/chat/services/loadGMHistory";
import { UserProps } from "../types/admin";
import { ChatProps, MessageProps } from "../types/chat";
import { STORES } from "../db/conf";
import { clearStore, addData, miniBatchInsertMessages } from "../db/crud";

const BATCH_SIZE = 100;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.GM_CHATS);
    await clearStore(STORES.GM_MESSAGES);
    await clearStore(STORES.GM_THREAD_MESSAGES);

    // Load data from backend
    const gmHistory: ChatProps[] = await loadGMHistory(
        myself.teamId,
        myself.teamName,
        myself.userId,
        accessToken
    );

    for (let i = 0; i < gmHistory.length; i += 1) {
        const gmChat: ChatProps = gmHistory[i];

        // Insert chat
        await addData({
            storeName: STORES.GM_CHATS,
            data: {
                chatId: gmChat.chatId,
                chatName: gmChat.chatName,
                unread: gmChat.unread,
                chatType: 2,
                dmPartnerUser: defaultDmPartner,
                latestMessage: gmChat.latestMessage,
                latestMessageText: gmChat.latestMessageText,
                TSLastMessage: gmChat.TSLastMessage,
            },
        });

        // Insert messages by mini-batch
        for (let i = 0; i < gmChat.messages.length; i += BATCH_SIZE) {
            const miniBatchMessages: MessageProps[] = gmChat.messages.slice(i, i + BATCH_SIZE);
            await miniBatchInsertMessages({
                storeName: STORES.GM_MESSAGES,
                miniBatchMessages: miniBatchMessages,
            });
        }
    }

    // Send finish a message
    self.postMessage("done");
};

export {};
