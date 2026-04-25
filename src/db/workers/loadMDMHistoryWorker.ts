import { defaultDmPartner } from "../../features/chat/services/constants";
import { loadMDMHistory } from "../../features/chat/services/loadMDMHistory";
import { UserProps } from "../../types/admin";
import { ChatProps, FlaggedMessageProps, MessageProps } from "../../types/chat";
import { ChatRepositoryFactory, FlaggedRepository } from "../repositories";
import { ChatService } from "../services";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    const mdmChatRepo = ChatRepositoryFactory.createMDMChatRepository();
    const mdmMessageRepo = ChatRepositoryFactory.createMDMMessageRepository();
    const mdmThreadRepo = ChatRepositoryFactory.createMDMThreadMessageRepository();
    const flaggedRepo = new FlaggedRepository();

    await mdmChatRepo.clear();
    await mdmMessageRepo.clear();
    await mdmThreadRepo.clear();

    // Load data from backend
    const mdmHistory: {
        chat_history: ChatProps[];
        flagged_messages: FlaggedMessageProps[];
    } = await loadMDMHistory(myself.teamId, myself.teamName, myself.userId, accessToken);

    for (let i = 0; i < mdmHistory.chat_history.length; i += 1) {
        const mdmChat: ChatProps = mdmHistory.chat_history[i];

        // Insert chat
        await mdmChatRepo.put({
            chatId: mdmChat.chatId,
            chatName: mdmChat.chatName,
            lastReadMessageId: mdmChat.lastReadMessageId,
            chatType: 4,
            dmPartnerUser: defaultDmPartner,
            latestMessage: mdmChat.latestMessage,
            latestMessageText: mdmChat.latestMessageText,
            TSLastMessage: mdmChat.TSLastMessage,
            isPinned: mdmChat.isPinned,
            tsLastAllReadActivity: mdmChat.tsLastAllReadActivity,
        });

        // Insert messages by mini-batch
        for (let i = 0; i < mdmChat.messages.length; i += BATCH_SIZE) {
            const miniBatch: MessageProps[] = mdmChat.messages.slice(i, i + BATCH_SIZE);
            await new ChatService().batchInsertMDMMessages(miniBatch);
        }
    }

    if (mdmHistory.flagged_messages) {
        for (let i = 0; i < mdmHistory.flagged_messages.length; i += 1) {
            const flaggedMessage: FlaggedMessageProps = mdmHistory.flagged_messages[i];
            await flaggedRepo.put(flaggedMessage);
        }
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
