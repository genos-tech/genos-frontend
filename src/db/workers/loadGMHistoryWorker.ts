import { defaultDmPartner } from "../../features/chat/services/constants";
import { loadGMHistory } from "../../features/chat/services/loadGMHistory";
import { UserProps } from "../../types/admin";
import { ChatProps, FlaggedMessageProps, MessageProps } from "../../types/chat";
import { ChatRepositoryFactory, FlaggedRepository } from "../repositories";
import { ChatService } from "../services";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    const gmChatRepo = ChatRepositoryFactory.createGMChatRepository();
    const gmMessageRepo = ChatRepositoryFactory.createGMMessageRepository();
    const gmThreadRepo = ChatRepositoryFactory.createGMThreadMessageRepository();
    const flaggedRepo = new FlaggedRepository();

    await gmChatRepo.clear();
    await gmMessageRepo.clear();
    await gmThreadRepo.clear();

    // Load data from backend
    const gmHistory: {
        chat_history: ChatProps[];
        flagged_messages: FlaggedMessageProps[];
    } = await loadGMHistory(myself.teamId, myself.teamName, myself.userId, accessToken);

    for (let i = 0; i < gmHistory.chat_history.length; i += 1) {
        const gmChat: ChatProps = gmHistory.chat_history[i];

        // Insert chat
        await gmChatRepo.put({
            chatId: gmChat.chatId,
            chatName: gmChat.chatName,
            lastReadMessageId: gmChat.lastReadMessageId,
            chatType: 2,
            dmPartnerUser: defaultDmPartner,
            latestMessage: gmChat.latestMessage,
            latestMessageText: gmChat.latestMessageText,
            TSLastMessage: gmChat.TSLastMessage,
            isPrivate: gmChat.isPrivate,
            profileImagePath: gmChat.profileImagePath,
            isPinned: gmChat.isPinned,
            tsLastAllReadActivity: gmChat.tsLastAllReadActivity,
        });

        // Insert messages by mini-batch
        for (let i = 0; i < gmChat.messages.length; i += BATCH_SIZE) {
            const miniBatch: MessageProps[] = gmChat.messages.slice(i, i + BATCH_SIZE);
            await new ChatService().batchInsertGMMessages(miniBatch);
        }
    }

    if (gmHistory.flagged_messages) {
        for (let i = 0; i < gmHistory.flagged_messages.length; i += 1) {
            const flaggedMessage: FlaggedMessageProps = gmHistory.flagged_messages[i];
            await flaggedRepo.put(flaggedMessage);
        }
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
