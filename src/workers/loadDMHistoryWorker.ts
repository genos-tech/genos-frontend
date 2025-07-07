import { loadDMHistory } from "../features/chat/services/loadDMHistory";
import { UserProps } from "../types/admin";
import { ChatProps, MessageProps } from "../types/chat";
import { STORES } from "../db/conf";
import { clearStore, addData, miniBatchInsertMessages } from "../db/crud";

const BATCH_SIZE = 100;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.DM_CHATS);

    // Load data from backend
    const dmHistory: ChatProps[] | undefined = await loadDMHistory(
        myself.teamId,
        myself.teamName,
        myself.userId,
        accessToken
    );

    if (dmHistory) {
        for (let i = 0; i < dmHistory.length; i += 1) {
            const dmChat: ChatProps = dmHistory[i];

            // Insert chat
            const newChatData = {
                storeName: STORES.DM_CHATS,
                data: {
                    chatId: dmChat.chatId,
                    chatName: dmChat.chatName,
                    unread: dmChat.unread,
                    isDm: true,
                    chatType: 1,
                    dmPartnerUser: dmChat.dmPartnerUser,
                    latestMessage: dmChat.latestMessage,
                    latestMessageText: dmChat.latestMessageText,
                    TSLastMessage: dmChat.TSLastMessage,
                },
            };
            await addData(newChatData);

            // Insert messages by mini-batch
            for (let i = 0; i < dmChat.messages.length; i += BATCH_SIZE) {
                const miniBatchMessages: MessageProps[] = dmChat.messages.slice(i, i + BATCH_SIZE);
                await miniBatchInsertMessages({
                    storeName: STORES.DM_MESSAGES,
                    miniBatchMessages: miniBatchMessages,
                });
            }
        }
        // Send finish a message
        self.postMessage("done");
    } else {
        self.postMessage("done");
    }
};

export {};
