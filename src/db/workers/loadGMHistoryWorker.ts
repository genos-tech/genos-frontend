import { defaultDmPartner } from "../../features/chat/services/constants";
import { loadGMHistory } from "../../features/chat/services/loadGMHistory";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps, FlaggedMessageProps, MessageProps } from "../../types/chat";
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
    // Shared service instance — the old code re-instantiated this inside the
    // per-batch inner loop, allocating one ChatService per 1000 messages.
    const chatService = new ChatService();

    // The three clears hit independent object stores — run them in parallel
    // instead of awaiting each in series.
    await Promise.all([gmChatRepo.clear(), gmMessageRepo.clear(), gmThreadRepo.clear()]);

    // Load data from backend
    const gmHistory: {
        chat_history: ChatProps[];
        flagged_messages: FlaggedMessageProps[];
    } = await loadGMHistory(myself.teamId, myself.teamName, myself.userId, accessToken);

    // Build chat-row payloads up front so we can write them in a single
    // batchInsert instead of N sequential `put`s.
    const chatRows: AllChatProps[] = gmHistory.chat_history.map((gmChat: ChatProps) => ({
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
    }));
    if (chatRows.length > 0) {
        await gmChatRepo.batchInsert(chatRows);
    }

    // Messages stay chunked per-chat (chats can be large; 1000-row mini-batches
    // bound IDB transaction size). Reusing `chatService` avoids the
    // per-iteration allocation that compounded across thousands of messages.
    for (const gmChat of gmHistory.chat_history) {
        for (let i = 0; i < gmChat.messages.length; i += BATCH_SIZE) {
            const miniBatch: MessageProps[] = gmChat.messages.slice(i, i + BATCH_SIZE);
            await chatService.batchInsertGMMessages(miniBatch);
        }
    }

    if (gmHistory.flagged_messages && gmHistory.flagged_messages.length > 0) {
        await flaggedRepo.batchInsert(gmHistory.flagged_messages);
    }

    // Send finish a message
    self.postMessage("done");

    self.close(); // Terminates itself
};

export {};
