import { defaultDmPartner } from "../../features/chat/services/constants";
import { loadMDMHistory } from "../../features/chat/services/loadMDMHistory";
import { UserProps } from "../../types/admin";
import { AllChatProps, ChatProps, FlaggedMessageProps, MessageProps } from "../../types/chat";
import { getLocalCurrentTimestamp } from "../../utils/dateUtils";
import { ChatRepositoryFactory, FlaggedRepository } from "../repositories";
import { ChatService } from "../services";

const BATCH_SIZE = 1000;

const buildChatRow = (mdmChat: ChatProps): AllChatProps => {
    const fallbackTs = mdmChat.TSLastMessage || getLocalCurrentTimestamp();
    const defaultLatestMessage: MessageProps = {
        chatType: 4,
        messageIdWithChatId: `${mdmChat.chatId}-0`,
        chatId: mdmChat.chatId,
        messageId: 0,
        content: [],
        contentText: "",
        sender: {
            userId: "",
            userName: "",
            avatarImgPath: "",
            tsLastSeen: "",
            tsJoined: "",
            customStatus: "",
        } as any,
        tsSent: fallbackTs,
        tsUpdated: fallbackTs,
        numReplies: 0,
        taskId: null,
        taskStatus: null,
    };
    return {
        chatId: mdmChat.chatId,
        chatName: mdmChat.chatName,
        lastReadMessageId: mdmChat.lastReadMessageId ?? -1,
        chatType: 4,
        dmPartnerUser: defaultDmPartner,
        latestMessage: mdmChat.latestMessage ?? defaultLatestMessage,
        latestMessageText: mdmChat.latestMessageText ?? "",
        TSLastMessage: fallbackTs,
        isPinned: mdmChat.isPinned,
        tsLastAllReadActivity: mdmChat.tsLastAllReadActivity,
        mdmMembers: mdmChat.mdmMembers,
    };
};

self.onmessage = async (event) => {
    try {
        const myself: UserProps = event.data.myself;
        const accessToken: string = event.data.accessToken;

        const mdmChatRepo = ChatRepositoryFactory.createMDMChatRepository();
        const mdmMessageRepo = ChatRepositoryFactory.createMDMMessageRepository();
        const mdmThreadRepo = ChatRepositoryFactory.createMDMThreadMessageRepository();
        const flaggedRepo = new FlaggedRepository();
        // Shared service instance — the old code re-instantiated this inside
        // the per-batch inner loop, allocating one ChatService per 1000
        // messages.
        const chatService = new ChatService();

        // The three clears hit independent object stores — run them in
        // parallel instead of awaiting each in series.
        await Promise.all([mdmChatRepo.clear(), mdmMessageRepo.clear(), mdmThreadRepo.clear()]);

        const mdmHistory: {
            chat_history: ChatProps[];
            flagged_messages: FlaggedMessageProps[];
        } = await loadMDMHistory(myself.teamId, myself.teamName, myself.userId, accessToken);

        // Build chat-row payloads up front so we can write them in a single
        // batchInsert instead of N sequential `put`s. The fallback-latest-
        // message synthesis lives in `buildChatRow` so the mapping stays a
        // one-liner.
        const chatRows = mdmHistory.chat_history.map(buildChatRow);
        if (chatRows.length > 0) {
            await mdmChatRepo.batchInsert(chatRows);
        }

        // Messages stay chunked per-chat (chats can be large; 1000-row
        // mini-batches bound IDB transaction size). Reusing `chatService`
        // avoids the per-iteration allocation that compounded across
        // thousands of messages.
        for (const mdmChat of mdmHistory.chat_history) {
            const messages = mdmChat.messages || [];
            for (let j = 0; j < messages.length; j += BATCH_SIZE) {
                const miniBatch: MessageProps[] = messages.slice(j, j + BATCH_SIZE);
                await chatService.batchInsertMDMMessages(miniBatch);
            }
        }

        if (mdmHistory.flagged_messages && mdmHistory.flagged_messages.length > 0) {
            await flaggedRepo.batchInsert(mdmHistory.flagged_messages);
        }

        self.postMessage("done");
    } catch (error) {
        console.error("[loadMDMHistoryWorker] Error:", error);
        self.postMessage("done");
    }

    self.close();
};

export {};
