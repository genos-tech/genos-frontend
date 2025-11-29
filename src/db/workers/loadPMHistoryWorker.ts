import { defaultDmPartner } from "../../features/chat/services/constants";
import { loadPMHistory } from "../../features/chat/services/loadPMHistory";
import { UserProps } from "../../types/admin";
import { ChatProps, FlaggedMessageProps, MessageProps } from "../../types/chat";
import { ChatRepositoryFactory, FlaggedRepository } from "../repositories";
import { ChatService } from "../services";

const BATCH_SIZE = 1000;

self.onmessage = async (event) => {
    const myself: UserProps = event.data.myself;
    const accessToken: string = event.data.accessToken;

    const pmChatRepo = ChatRepositoryFactory.createPMChatRepository();
    const pmMessageRepo = ChatRepositoryFactory.createPMMessageRepository();
    const pmThreadRepo = ChatRepositoryFactory.createPMThreadMessageRepository();
    const flaggedRepo = new FlaggedRepository();

    await pmChatRepo.clear();
    await pmMessageRepo.clear();
    await pmThreadRepo.clear();

    // Load data from backend
    const pmHistory: {
        chat_history: ChatProps[];
        flagged_messages: FlaggedMessageProps[];
    } = await loadPMHistory(myself.teamId, myself.teamName, myself.userId, accessToken);

    for (let i = 0; i < pmHistory.chat_history.length; i += 1) {
        const pmChat: ChatProps = pmHistory.chat_history[i];

        // Insert chat
        await pmChatRepo.put({
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
            profileImagePath: pmChat.profileImagePath,
            isPinned: pmChat.isPinned,
            tsLastAllReadActivity: pmChat.tsLastAllReadActivity,
        });

        // Insert messages by mini-batch
        for (let i = 0; i < pmChat.messages.length; i += BATCH_SIZE) {
            const miniBatch: MessageProps[] = pmChat.messages.slice(i, i + BATCH_SIZE);
            await new ChatService().batchInsertPMMessages(miniBatch);
        }
    }

    if (pmHistory.flagged_messages) {
        for (let i = 0; i < pmHistory.flagged_messages.length; i += 1) {
            const flaggedMessage: FlaggedMessageProps = pmHistory.flagged_messages[i];
            await flaggedRepo.put(flaggedMessage);
        }
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
