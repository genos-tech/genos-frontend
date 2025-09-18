import { defaultDmPartner } from "../features/chat/services/constants";
import { loadPMHistory } from "../features/chat/services/loadPMHistory";
import { UserProps } from "../types/admin";
import { ChatProps, MessageProps } from "../types/chat";
import { STORES } from "../db/conf";
import { clearStore, addData, miniBatchInsertMessages } from "../db/crud";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.PM_CHATS);
    await clearStore(STORES.PM_MESSAGES);
    await clearStore(STORES.PM_THREAD_MESSAGES);

    // Load data from backend
    const pmHistory: ChatProps[] = await loadPMHistory(
        myself.teamId,
        myself.teamName,
        myself.userId,
        accessToken
    );

    for (let i = 0; i < pmHistory.length; i += 1) {
        const pmChat: ChatProps = pmHistory[i];

        // Insert chat
        await addData({
            storeName: STORES.PM_CHATS,
            data: {
                chatId: pmChat.chatId,
                chatName: pmChat.chatName,
                systemUserId: pmChat.systemUserId,
                lastReadMessageId: pmChat.lastReadMessageId,
                chatType: 3,
                dmPartnerUser: defaultDmPartner,
                latestMessage: pmChat.latestMessage,
                latestMessageText: pmChat.latestMessageText,
                TSLastMessage: pmChat.TSLastMessage,
                project: pmChat.project,
            },
        });

        // Insert messages by mini-batch
        for (let i = 0; i < pmChat.messages.length; i += BATCH_SIZE) {
            const miniBatchMessages: MessageProps[] = pmChat.messages.slice(i, i + BATCH_SIZE);
            await miniBatchInsertMessages({
                storeName: STORES.PM_MESSAGES,
                miniBatchMessages: miniBatchMessages,
            });
        }
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
