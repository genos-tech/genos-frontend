import { loadDMHistory } from "../features/chat/services/loadDMHistory";
import { UserProps } from "../types/admin";
import { ChatProps, MessageProps, FlaggedMessageProps } from "../types/chat";
import { STORES } from "../db/conf";
import { clearStore, addData, miniBatchInsert } from "../db/crud";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    await clearStore(STORES.DM_CHATS);
    await clearStore(STORES.DM_MESSAGES);
    await clearStore(STORES.DM_THREAD_MESSAGES);

    // Load data from backend
    const dmHistory: {
        chat_history: ChatProps[];
        flagged_messages: FlaggedMessageProps[];
    } = await loadDMHistory(myself.teamId, myself.teamName, myself.userId, accessToken);

    if (dmHistory) {
        if (dmHistory.chat_history) {
            for (let i = 0; i < dmHistory.chat_history.length; i += 1) {
                const dmChat: ChatProps = dmHistory.chat_history[i];

                // Insert chat
                const newChatData = {
                    storeName: STORES.DM_CHATS,
                    data: {
                        chatId: dmChat.chatId,
                        chatName: dmChat.chatName,
                        lastReadMessageId: dmChat.lastReadMessageId,
                        chatType: 1,
                        dmPartnerUser: dmChat.dmPartnerUser,
                        latestMessage: dmChat.latestMessage,
                        latestMessageText: dmChat.latestMessageText,
                        TSLastMessage: dmChat.TSLastMessage,
                        isPinned: dmChat.isPinned,
                        tsLastAllReadActivity: dmChat.tsLastAllReadActivity,
                    },
                };
                await addData(newChatData);

                // Insert messages by mini-batch
                for (let i = 0; i < dmChat.messages.length; i += BATCH_SIZE) {
                    const miniBatch: MessageProps[] = dmChat.messages.slice(i, i + BATCH_SIZE);
                    await miniBatchInsert({
                        storeName: STORES.DM_MESSAGES,
                        miniBatch: miniBatch,
                    });
                }
            }
        }
        if (dmHistory.flagged_messages) {
            for (let i = 0; i < dmHistory.flagged_messages.length; i += 1) {
                const flaggedMessage: FlaggedMessageProps = dmHistory.flagged_messages[i];
                await addData({
                    storeName: STORES.FLAGGED_MESSAGES,
                    data: flaggedMessage,
                });
            }
        }
        // Send finish a message
        self.postMessage("done");
    } else {
        self.postMessage("done");
    }

    self.close(); // Terminates itself
};

export {};
