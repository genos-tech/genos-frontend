import { defaultDmPartner } from "../../features/chat/services/constants";
import { loadPMHistory } from "../../features/chat/services/loadPMHistory";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps, FlaggedMessageProps, MessageProps } from "../../types/chat";
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
    // Shared service instance — the old code re-instantiated this inside the
    // per-batch inner loop, allocating one ChatService per 1000 messages.
    const chatService = new ChatService();

    // The three clears hit independent object stores — run them in parallel
    // instead of awaiting each in series.
    await Promise.all([pmChatRepo.clear(), pmMessageRepo.clear(), pmThreadRepo.clear()]);

    // Load data from backend
    const pmHistory: {
        chat_history: ChatProps[];
        flagged_messages: FlaggedMessageProps[];
    } = await loadPMHistory(myself.teamId, myself.teamName, myself.userId, accessToken);

    // Build chat-row payloads up front so we can write them in a single
    // batchInsert instead of N sequential `put`s.
    const chatRows: AllChatProps[] = pmHistory.chat_history.map((pmChat: ChatProps) => ({
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
    }));
    if (chatRows.length > 0) {
        await pmChatRepo.batchInsert(chatRows);
    }

    // Messages stay chunked per-chat (chats can be large; 1000-row mini-batches
    // bound IDB transaction size). Reusing `chatService` avoids the
    // per-iteration allocation that compounded across thousands of messages.
    for (const pmChat of pmHistory.chat_history) {
        for (let i = 0; i < pmChat.messages.length; i += BATCH_SIZE) {
            const miniBatch: MessageProps[] = pmChat.messages.slice(i, i + BATCH_SIZE);
            await chatService.batchInsertPMMessages(miniBatch);
        }
    }

    if (pmHistory.flagged_messages && pmHistory.flagged_messages.length > 0) {
        await flaggedRepo.batchInsert(pmHistory.flagged_messages);
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
