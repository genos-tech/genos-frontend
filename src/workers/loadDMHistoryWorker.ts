import { ChatRepositoryFactory, FlaggedRepository } from "../db/repositories";
import { loadDMHistory } from "../features/chat/services/loadDMHistory";
import { UserProps } from "../types/admin";
import { ChatProps, FlaggedMessageProps, MessageProps } from "../types/chat";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    const dmChatRepo = ChatRepositoryFactory.createDMChatRepository();
    const dmMessageRepo = ChatRepositoryFactory.createDMMessageRepository();
    const dmThreadRepo = ChatRepositoryFactory.createDMThreadMessageRepository();
    const flaggedRepo = new FlaggedRepository();

    await dmChatRepo.clear();
    await dmMessageRepo.clear();
    await dmThreadRepo.clear();

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
                await dmChatRepo.put({
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
                });

                // Insert messages by mini-batch
                for (let i = 0; i < dmChat.messages.length; i += BATCH_SIZE) {
                    const miniBatch: MessageProps[] = dmChat.messages.slice(i, i + BATCH_SIZE);
                    await dmMessageRepo.batchInsertMessages(miniBatch);
                }
            }
        }

        if (dmHistory.flagged_messages) {
            for (let i = 0; i < dmHistory.flagged_messages.length; i += 1) {
                const flaggedMessage: FlaggedMessageProps = dmHistory.flagged_messages[i];
                await flaggedRepo.put(flaggedMessage);
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
