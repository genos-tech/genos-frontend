import { loadDMHistory } from "../../features/chat/services/loadDMHistory";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps, FlaggedMessageProps, MessageProps } from "../../types/chat";
import { ChatRepositoryFactory, FlaggedRepository } from "../repositories";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    const dmChatRepo = ChatRepositoryFactory.createDMChatRepository();
    const dmMessageRepo = ChatRepositoryFactory.createDMMessageRepository();
    const dmThreadRepo = ChatRepositoryFactory.createDMThreadMessageRepository();
    const flaggedRepo = new FlaggedRepository();

    // The three clears hit independent object stores — run them in parallel
    // instead of awaiting each in series.
    await Promise.all([dmChatRepo.clear(), dmMessageRepo.clear(), dmThreadRepo.clear()]);

    // Load data from backend
    const dmHistory: {
        chat_history: ChatProps[];
        flagged_messages: FlaggedMessageProps[];
    } = await loadDMHistory(myself.teamId, myself.teamName, myself.userId, accessToken);

    if (dmHistory) {
        if (dmHistory.chat_history) {
            // Build chat-row payloads up front so we can write them in a
            // single batchInsert instead of N sequential `put`s.
            const chatRows: AllChatProps[] = dmHistory.chat_history.map((dmChat: ChatProps) => ({
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
            }));
            if (chatRows.length > 0) {
                await dmChatRepo.batchInsert(chatRows);
            }

            // Messages stay chunked per-chat (chats can be large; 1000-row
            // mini-batches bound IDB transaction size).
            for (const dmChat of dmHistory.chat_history) {
                for (let i = 0; i < dmChat.messages.length; i += BATCH_SIZE) {
                    const miniBatch: MessageProps[] = dmChat.messages.slice(i, i + BATCH_SIZE);
                    await dmMessageRepo.batchInsertMessages(miniBatch);
                }
            }
        }

        if (dmHistory.flagged_messages && dmHistory.flagged_messages.length > 0) {
            await flaggedRepo.batchInsert(dmHistory.flagged_messages);
        }
        // Send finish a message
        self.postMessage("done");
    } else {
        self.postMessage("done");
    }

    self.close(); // Terminates itself
};

export {};
